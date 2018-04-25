const format = require("date-fns/format");
const jwt = require("jsonwebtoken");
const path = require("path");
const pug = require("pug");
const uuid = require("short-uuid");

const dbPromise = require("../db").dbPromise;
const util = require("../util");

const offerLetterTemplate = pug.compileFile(
  path.join(process.cwd(), "src/templates/OfferLetter.pug")
);

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!(email && password))
    return res.status(400).json({ error: "Malformed request" });
  const db = await dbPromise;
  const user = await db.get(
    `
    SELECT
      u.email,
      u.passwordHash,
      u.title,
      u.firstName,
      u.lastName,
      u.isAdministrator,
      c.id AS companyId,
      c.name AS companyName,
      c.hasProvidedData
      FROM users u
      INNER JOIN companies c
      ON u.companyId = c.id
      WHERE u.email = ?;
  `,
    email
  );
  const validPassword = await util.comparePassword(
    password,
    user.passwordHash || ""
  );
  if (!(user && validPassword))
    return res.status(401).json({ error: "Invalid email or password" });
  const { passwordHash, ...userSanitized } = user;
  const token = util.generateToken(userSanitized);
  userSanitized.token = token;
  return res.json({ user: userSanitized });
};

const checkToken = (req, res) => {
  if (req.user) {
    return res.json({ user: req.user });
  }
  return res.status(401).json({ error: "invalid token" });
};

const createCompany = async (req, res) => {
  try {
    const { email, password, companyName } = req.body;
    if (!(email && password && companyName) || password.length < 8)
      return res.status(400).json({ error: "Malformed request" });
    const db = await dbPromise;
    const user = await db.get("SELECT * FROM users WHERE email = ?", email);
    if (user !== undefined)
      return res.status(401).json({ error: "User is already registered" });
    // TODO: verification for attempts to register known companies
    // without company email address?
    const pwHash = await util.hashPassword(password);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCompanyName = companyName.trim();
    // create company
    await db.run(
      `INSERT INTO companies(
        name,
        accountLevel
      ) VALUES (?, ?)`,
      normalizedCompanyName,
      "trial"
    );
    // get company ID - all users are associated with a company, so we need this first
    let companyId = await db.get(
      `SELECT id FROM COMPANIES WHERE name = ?`,
      normalizedCompanyName
    );
    // create user and associate with company
    await db.run(
      `INSERT INTO users(
        email,
        passwordHash,
        companyID,
        isAdministrator,
        isActive,
        hasRegistered
      ) VALUES(?,?,?,?,?,?)`,
      normalizedEmail,
      pwHash,
      companyId.id,
      1,
      1,
      1
    );
    // get user ID and set creator to company owner
    let userId = await db.get(
      `SELECT id FROM USERS WHERE email = ?`,
      normalizedEmail
    );
    const setOwner = await db.run(
      `UPDATE companies SET owner = ? WHERE id = ?`,
      userId.id,
      companyId.id
    );
    req.body.email = normalizedEmail;
    req.body.password = password;
    return login(req, res);
    res.json({ company: companyName, owner: normalizedEmail });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Unable to create company" });
  }
};

const getCompanyInfo = async (req, res) => {
  const user = req.user;
  // todo: handle user error
  const db = await dbPromise;
  const companyInfo = await db.get(
    `
    SELECT
      c.name,
      c.logo,
      c.state,
      c.stockPlanName,
      c.hasProvidedData
    FROM companies c
    INNER JOIN users u
    ON c.id = u.companyId
    WHERE c.id = ?
  `,
    user.companyId
  );
  return res.json(companyInfo);
};

const getTemplateAutocomplete = async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "not authorized" });
  const term = req.query.term;
  const db = await dbPromise;
  const suggestions = await db.all(
    `
    SELECT
      previewURL,
      (firstName || ' ' || lastName) as name,
      jobTitle,
      created
    FROM offers
    WHERE company LIKE ?
    AND (firstName LIKE (? || '%') COLLATE NOCASE
    OR lastName LIKE  (? || '%') COLLATE NOCASE
    OR jobTitle LIKE ('%' || ? || '%') COLLATE NOCASE)
    ORDER BY created DESC
  `,
    user.companyId,
    term,
    term,
    term
  );
  res.json({ suggestions });
};

const setCompanyInfo = async (req, res) => {
  const user = req.user;
  const db = await dbPromise;
  const { name, logo, state, stateFull, stockPlanName } = req.body;
  const result = await db.run(
    `
    UPDATE companies
      SET name=?, logo=?, state=?, stateFull=?, stockPlanName=?, hasProvidedData = ?
      WHERE id = (SELECT companyId FROM users WHERE email=?)
  `,
    name,
    logo,
    state,
    stateFull,
    stockPlanName,
    1,
    user.email
  );
  res.json({ status: "ok" });
};

const getOfferLetter = async (req, res) => {
  const id = req.params.id;
  const db = await dbPromise;
  const letter = await db.get(
    `
    SELECT * FROM offers
    WHERE previewURL = ? OR companyURL = ? OR employeeURL = ?
  `,
    id,
    id,
    id
  );
  if (!letter) return res.status(404).json({ error: "no such document" });
  await db.run(
    `
    INSERT INTO offerEvents(
      priority,
      eventType,
      eventURL,
      documentID,
      eventData,
      eventDataHash,
      userIpAddress,
      companyId
    ) VALUES (?,?,?,?,?,?,?,?)
    `,
    3,
    "offer_letter_viewed",
    req.originalURL,
    letter.id,
    letter.html,
    util.crypto.hash(letter.html),
    "fake address",
    letter.company
  );
  const { previewURL, companyURL, employeeURL, ...cleanLetter } = letter;
  if (id === previewURL) cleanLetter.previewURL = previewURL;
  if (id === companyURL) cleanLetter.companyURL = companyURL;
  if (id === employeeURL) cleanLetter.employeeURL = employeeURL;
  return res.json(cleanLetter);
};

const getPendingOffers = async (req, res) => {
  const user = req.user;
  const db = await dbPromise;
  const offers = await db.all(
    `
    SELECT
      (firstName || ' ' || lastName) AS name,
      email,
      jobTitle,
      payRate,
      equityType,
      equityAmount,
      status,
      created,
      previewURL,
      offerDateFormatted,
      respondByFormatted,
      owner
    FROM offers
    WHERE company = ? AND status != 'done'
  `,
    user.companyId
  );
  res.json({ offers });
};

const generateOfferLetter = async (req, res) => {
  // get company data from user auth info
  if (!req.user)
    return res.status(401).json({ error: "This route is authenticated" });
  let offer = req.body.offer;
  let user = req.user;
  const db = await dbPromise;
  const company = await db.get(
    `
    SELECT
      c.id as company,
      c.name as companyName,
      c.state,
      c.stateFull,
      c.logo,
      c.stockPlanName,
      u.id as owner
    FROM users u
    INNER JOIN companies c
    ON u.companyId = c.id
    WHERE u.email = ?
  `,
    user.email.toLowerCase()
  );

  // build offer letter object
  offer = {
    ...company,
    ...offer,
    previewURL: uuid.uuid(),
    status: "preview",
    offerDateFormatted: format(offer.offerDate, "MMMM D, YYYY"),
    respondByFormatted: format(offer.respondBy, "MMMM D, YYYY")
  };
  offer.html = offerLetterTemplate({ offer });

  // add to DB
  await db.run(
    `
    INSERT INTO offers(
      status,
      owner,
      company,
      companyName,
      firstName,
      lastName,
      email,
      jobTitle,
      payUnit,
      payRate,
      equityType,
      equityAmount,
      vesting,
      fulltime,
      hasBenefits,
      supervisorName,
      supervisorTitle,
      supervisorEmail,
      offerDate,
      offerDateFormatted,
      respondBy,
      respondByFormatted,
      html,
      status,
      previewURL
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    offer.status,
    offer.owner,
    offer.company,
    offer.companyName,
    offer.firstName,
    offer.lastName,
    offer.email,
    offer.jobTitle,
    offer.payUnit,
    offer.payRate,
    offer.equityType,
    offer.equityAmount,
    offer.vesting,
    offer.fulltime,
    offer.hasBenefits,
    offer.supervisorName,
    offer.supervisorTitle,
    offer.supervisorEmail,
    offer.offerDate,
    offer.offerDateFormatted,
    offer.respondBy,
    offer.respondByFormatted,
    offer.html,
    offer.status,
    offer.previewURL
  );
  await db.run(
    `
    INSERT INTO offerEvents(
      priority,
      eventType,
      eventURL,
      eventData,
      eventDataHash,
      userId,
      userIpAddress,
      documentId,
      companyId
    ) VALUES (?,?,?,?,?,?,?,?,?)
  `,
    2,
    "offer_letter_created",
    req.originalURL,
    offer.html,
    util.crypto.hash(offer.html),
    offer.owner,
    "fake address",
    offer.id,
    offer.company
  );

  // reply with offer letter object
  return res.json({
    previewURL: offer.previewURL
  });
};

const confirmOfferLetter = async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Authentication required" });
  const id = req.params.id;
  const db = await dbPromise;
  const letter = await db.get(
    `
    SELECT o.id, o.status, o.company, o.supervisorName, o.supervisorEmail, o.companyURL, o.html
      FROM offers o
      WHERE o.previewURL = ?
  `,
    id
  );
  if (letter.companyURL)
    return res.status(401).json({
      error: "This letter has already been confirmed!"
    });
  const companyURL = uuid.uuid();
  await db.run(
    `
    UPDATE offers
      SET status = 'awaiting_company_signature', companyURL = ?
      WHERE previewURL = ?`,
    companyURL,
    id
  );
  await db.run(
    `
    INSERT INTO offerEvents(
      priority,
      eventType,
      eventURL,
      eventData,
      eventDataHash,
      userId,
      userIpAddress,
      companyId,
      documentId
    ) VALUES (?,?,?,?,?,?,?,?,?)
  `,
    1,
    "offer_letter_sent_to_company",
    req.originalURL,
    letter.html,
    util.crypto.hash(letter.html),
    user.id,
    "fake address",
    letter.company,
    letter.id
  );

  res.json({ status: "ok" });
};

const signOfferLetter = async (req, res) => {
  // add signature to master document object and advance status
  const { id, companyId, html, signature, status } = req.body;
  // TODO: validate fields
  const db = await dbPromise;
  if (status === "awaiting_company_signature") {
    // todo: check if signature already applied
    await db.run(
      `
      UPDATE offers
        SET status = ?, companySignature = ?, employeeURL = ?
        WHERE companyURL = ? and companySignature IS NULL
    `,
      "awaiting_employee_signature",
      signature,
      uuid.uuid(),
      id
    );
    await db.run(
      `
      INSERT INTO offerEvents(
        priority,
        eventType,
        eventURL,
        eventData,
        eventDataHash,
        userIpAddress,
        documentId,
        companyId
      ) VALUES (?,?,?,?,?,?,?,?)
    `,
      1,
      "offer_letter_signed_company",
      req.originalURL,
      html,
      util.crypto.hash(html),
      "fake address",
      id,
      companyId
    );
    return res.json({ status: "ok" });
  }
  if (status === "awaiting_employee_signature") {
    // todo: check if signature already applied
    await db.run(
      `
      UPDATE offers
        SET status = ?, employeeSignature = ?
        WHERE employeeURL = ? and employeeSignature IS NULL
    `,
      "done",
      signature,
      id
    );
    await db.run(
      `
      INSERT INTO offerEvents(
        priority,
        eventType,
        eventURL,
        eventData,
        eventDataHash,
        userIpAddress,
        documentId,
        companyId
      ) VALUES (?,?,?,?,?,?,?,?)
    `,
      1,
      "offer_letter_signed_employee",
      req.originalURL,
      html,
      util.crypto.hash(html),
      "fake address",
      id,
      companyId
    );
    return res.json({ status: "ok" });
  }
  return res.status(400).json({ error: "Invalid signing!" });
};
const getRecentEvents = async (req, res) => {
  const user = req.user;
  const db = await dbPromise;
  const results = await db.all(
    `
    SELECT
      o.firstName,
      o.lastName,
      o.email,
      o.status,
      o.supervisorName,
      o.supervisorEmail,
      e.eventType,
      e.eventTime,
      e.id as eventId
    FROM offers o
    INNER JOIN offerEvents e
    ON e.companyId = o.company
    WHERE o.company = ?
    AND e.priority < 2
    ORDER BY e.eventTime DESC
    LIMIT 10;
  `,
    user.companyId
  );
  return res.json(results);
};

module.exports = {
  login,
  checkToken,
  createCompany,
  getCompanyInfo,
  setCompanyInfo,
  getPendingOffers,
  getTemplateAutocomplete,
  getOfferLetter,
  generateOfferLetter,
  confirmOfferLetter,
  signOfferLetter,
  getRecentEvents
};

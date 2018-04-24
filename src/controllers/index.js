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
      c.name AS companyName
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
  return res.json(letter);
};

const generateOfferLetter = async (req, res) => {
  // get company data from user auth info
  if (!req.user)
    return res.status(401).json({ error: "This route is authenticated" });
  let { _, ...offer } = req.body;
  let user = req.user;
  const db = await dbPromise;
  const company = await db.get(
    `
    SELECT
      c.id as companyId,
      c.name as companyName,
      c.state,
      c.stateFull,
      c.logo,
      c.stockPlanName,
      u.id as ownerId
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
  console.log("equity type:", offer.equityType);
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

  // reply with offer letter object
  return res.json({
    previewURL: offer.previewURL
  });
};

const confirmOfferLetter = async (req, res) => {
  const id = req.body.previewURL;
  const db = await dbPromise;
  const letter = await db.get(
    `
    SELECT o.status, o.supervisorName, o.supervisorEmail, o.companyURL
      FROM offers o
      WHERE o.previewURL = ?
  `,
    id
  );
  if (letter.companyURL)
    return res.json({
      status: "ok",
      message: "This letter has already been confirmed!"
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
  res.json({ status: "ok" });
};

const signOfferLetter = async (req, res) => {
  // add signature to master document object and advance status
  const { id, html, signature, status } = req.body;
  console.log(status);
  if (status === "awaiting_company_signature") {
    const db = await dbPromise;
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
    return res.json({ status: "ok" });
  }
  if (status === "awaiting_employee_signature") {
    const db = await dbPromise;
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
    return res.json({ status: "ok" });
  }
  return res.status(400).json({ error: "Invalid signing!" });
};

module.exports = {
  login,
  checkToken,
  createCompany,
  getOfferLetter,
  generateOfferLetter,
  confirmOfferLetter,
  signOfferLetter
};

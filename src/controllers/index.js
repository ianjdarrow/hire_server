const format = require("date-fns/format");
const jwt = require("jsonwebtoken");
const path = require("path");
const pug = require("pug");
const uuid = require("short-uuid");

const dbPromise = require("../db").dbPromise;
const util = require("../util");

let offerLetters = {};
const offerLetterTemplate = pug.compileFile(
  path.join(process.cwd(), "src/templates/OfferLetter.pug")
);

// const createUser = (req, res) => {
//   const db = await dbPromise;
//   if (!(req.body.email && req.body.password))
//     return res.status(400).json({ error: "bad username or pass" });
//   const exists = db.get(`SELECT FROM users WHERE email = ?`, req.body.email);
//   if (exists.length > 0) return res.status(401).json({ error: "email taken" });
//   db.run('INSERT INTO users(')
// };

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
  const { passwordHash, ...userToken } = user;
  const token = util.generateToken(userToken);
  res.cookie("Authorization", token);
  return res.json(userToken);
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
    console.log(setOwner);
    res.json({ company: companyName, owner: normalizedEmail });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Unable to create company" });
  }
};

// initialize mock offer letter and add to janky store
const options = util.mockOfferLetter;
const offerLetter = offerLetterTemplate(options);
offerLetters[options.offer.id] = { html: offerLetter, options };

const getIndex = (req, res) => {
  res.json(offerLetters["a"]);
};
const getOfferLetter = (req, res) => {
  const id = req.params.id;
  if (!id in offerLetters)
    return res.status(404).json({ error: "no such document" });
  return res.json(offerLetters[id]);
};
const previewOfferLetter = async (req, res) => {
  const customOptions = {
    offer: {
      offerDateFormatted: format(req.body.offerDate, "MMMM D, YYYY"),
      respondByFormatted: format(req.body.respondBy, "MMMM D, YYYY"),
      ...req.body
    },
    company: { ...options.company }
  };
  const offerLetter = offerLetterTemplate(customOptions);
  return res.json({ html: offerLetter, options: customOptions });
};
const generateOfferLetter = async (req, res) => {
  const customOptions = {
    offer: {
      status: "awaiting_company_signature",
      ...req.body
    },
    company: { ...options.company }
  };
  const offerLetter = offerLetterTemplate(customOptions);
  const id = uuid.uuid();
  customOptions.offer.id = id;
  offerLetters[id] = { html: offerLetter, options: customOptions };
  console.log(id);
  return res.json({
    id
  });
};

const signOfferLetter = async (req, res) => {
  // add signature to master document object and advance status
  const { signature, id, status } = req.body;
  const letter = offerLetters[id];
  if (req.body.status === "awaiting_company_signature") {
    letter.options.offer.companySignatureImage = signature;
    letter.options.offer.status = "done";

    const nextLetter = JSON.parse(JSON.stringify(letter));
    const newId = uuid.uuid();
    nextLetter.options.offer.id = newId;
    nextLetter.options.offer.status = "awaiting_employee_signature";
    offerLetters[newId] = nextLetter;
    console.log(newId);

    return res.json({ status: "ok", id: nextLetter.options.offer.id });
  }
  if (req.body.status === "awaiting_employee_signature") {
    letter.options.offer.employeeSignatureImage = signature;
    letter.options.offer.status = "done";
    return res.json({ status: "ok" });
  }
};

module.exports = {
  getIndex,
  login,
  createCompany,
  // createUser,
  getOfferLetter,
  previewOfferLetter,
  generateOfferLetter,
  signOfferLetter
};

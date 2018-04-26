const format = require("date-fns/format");
const jwt = require("jsonwebtoken");
const path = require("path");
const pug = require("pug");
const uuid = require("short-uuid");

const dbPromise = require("../db").dbPromise;
const util = require("../util");

// import controllers
const auth = require("./auth");
const companies = require("./companies");
const employeeOfferLetter = require("./documents/employeeOfferLetter");

const employeeCIIATemplate = pug.compileFile(
  path.join(process.cwd(), "src/templates/EmployeeCIIA.pug")
);

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
    req.originalUrl,
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
  const { id, documentId, companyId, html, signature, status } = req.body;
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
      documentId
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
      req.originalUrl,
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
      documentId
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
      req.originalUrl,
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

const deleteOfferLetter = async (req, res) => {
  const user = req.user;
  const offerId = req.params.id;
  if (!offerId || !user)
    return res
      .status(400)
      .json({ error: "must specify offerId as query string" });
  const db = await dbPromise;
  const request = await db.run(
    `
    DELETE FROM offers
    WHERE id = ?
    AND company = ?
    AND status = 'preview'
  `,
    offerId,
    user.companyId
  );
  console.log(request);
  // todo: check if actually deleted
  res.json({ status: "ok" });
};

module.exports = {
  // authentication
  login: auth.login,
  checkToken: auth.checkToken,

  // company management
  createCompany: companies.createCompany,
  getCompanyInfo: companies.getCompanyInfo,
  setCompanyInfo: companies.setCompanyInfo,
  getPendingOffers: companies.getPendingOffers,
  getCompanyFeed: companies.getCompanyFeed,
  offerTemplateSearch: companies.offerTemplateSearch,

  // offer letter management
  generateOfferLetter: employeeOfferLetter.generateOfferLetter,
  getOfferLetter: employeeOfferLetter.getOfferLetter,
  confirmOfferLetter,
  signOfferLetter,
  deleteOfferLetter
};

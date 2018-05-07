const joi = require("joi");
const path = require("path");
const stringSimilarity = require("string-similarity");
const uuid = require("short-uuid");

const dbPromise = require(path.join(process.cwd(), "src/db")).dbPromise;
const util = require(path.join(process.cwd(), "src/util"));

const auth = require("../auth");
const mail = require("../../mail");

//
// Create a new company and its owner/user, all at once.
//
const createCompanySchema = joi.object().keys({
  companyName: joi.string().required(),
  entityType: joi.string().required(),
  state: joi.string().required(),
  hasStockPlan: joi.string().required(),
  stockPlanName: joi.string().allow(""),
  logo: joi.string().allow("")
});

exports.createCompany = async (req, res) => {
  const validate = joi.validate(req.body, createCompanySchema);
  if (validate.error) {
    return res.status(400).json({ error: "schema_error" });
  }
  const db = await dbPromise;
  const newCompany = await db.run(
    `INSERT INTO companies(
    name,
    entityType,
    stateFull,
    hasStockPlan,
    stockPlanName,
    logo,
    owner
  ) VALUES (?,?,?,?,?,?, (SELECT id FROM users WHERE email = ?))
    `,
    req.body.companyName,
    req.body.entityType,
    req.body.state,
    req.body.hasStockPlan,
    req.body.stockPlanName,
    req.body.logo,
    req.user.email
  );
  if (!newCompany.changes)
    return res.status(500).json({ error: "Error creating company" });
  const associateUser = await db.run(
    `
  UPDATE users
  SET companyId = ?
  WHERE email = ?
  `,
    newCompany.lastID,
    req.user.email
  );
  if (!associateUser.changes)
    return res
      .status(500)
      .json({ error: "Error associating user with company" });
  return res.json({});
};

//
// pull company ID from a user's validated token and
// retrieve relevant company info for review/update
//

exports.getCompanyInfo = async (req, res) => {
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
    req.user.companyId
  );
  return res.json(companyInfo);
};

const companyInfoSchema = joi.object().keys({
  name: joi.string().required(),
  logo: joi
    .string()
    .regex(/^data:image\/(svg\+xml|gif|jpeg|jpg|svg|png)/)
    .max(256 * 1024, "utf8")
    .allow(""),
  state: joi
    .string()
    .min(2)
    .max(2)
    .required(),
  stateFull: joi.string().required(),
  stockPlanName: joi.string().required()
});

exports.setCompanyInfo = async (req, res) => {
  const validate = joi.validate(req.body, companyInfoSchema);
  if (validate.error) return res.status(400).json({});
  const user = req.user;
  const db = await dbPromise;
  const { name, logo, state, stateFull, stockPlanName } = req.body;
  const update = await db.run(
    `
    UPDATE companies
      SET name=?, logo=?, state=?, stateFull=?, stockPlanName=?, hasProvidedData = ?
      WHERE id = ?
  `,
    name,
    logo,
    state,
    stateFull,
    stockPlanName,
    1,
    user.companyId
  );
  if (!update.changes) {
    return res.status(500).json({ error: "Failed to update company" });
  }
  return res.json({});
};

exports.getPendingOffers = async (req, res) => {
  const user = req.user;
  const db = await dbPromise;
  const offers = await db.all(
    `
    SELECT
      id,
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

exports.getCompanyFeed = async (req, res) => {
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
      e.created,
      e.id as eventId
    FROM offerEvents e
    INNER JOIN offers o
    ON o.id = e.documentId
    WHERE e.companyId = ?
    AND e.priority < 2
    ORDER BY e.created DESC
    LIMIT 6;
  `,
    user.companyId
  );
  return res.json(results);
};

const offerTemplateSearchSchema = joi
  .string()
  .min(2)
  .max(20);

exports.offerTemplateSearch = async (req, res) => {
  const user = req.user;
  const term = req.query.term;
  const validate = joi.validate(term, offerTemplateSearchSchema);
  if (validate.error) return res.status(400).json({});
  const db = await dbPromise;

  //   AND (firstName LIKE (? || '%') COLLATE NOCASE
  //   OR lastName LIKE  (? || '%') COLLATE NOCASE
  //   OR jobTitle LIKE ('%' || ? || '%') COLLATE NOCASE)

  const result = await db.all(
    `
    SELECT
      previewURL,
      firstName,
      lastName,
      (firstName || ' ' || lastName) as name,
      jobTitle,
      created
    FROM offers
    WHERE company LIKE ?
    ORDER BY created DESC
    LIMIT 100
  `,
    user.companyId
  );
  const suggestions = result
    .map(item => {
      // find best fuzzy match across all the relevant object properties
      // and assign it to the object
      const score = Math.max(
        stringSimilarity.compareTwoStrings(
          item.firstName.toLowerCase(),
          term.toLowerCase()
        ),
        stringSimilarity.compareTwoStrings(
          item.lastName.toLowerCase(),
          term.toLowerCase()
        ),
        stringSimilarity.compareTwoStrings(
          item.jobTitle.toLowerCase(),
          term.toLowerCase()
        )
      );
      return { ...item, score };
    })
    // eliminate obviously irrelevant matches
    .filter(item => item.score > 0.5)
    // order by relevance
    .sort((a, b) => b.score - a.score)
    // only return 5 results for legibility
    .slice(0, 5);
  res.json({ suggestions });
};

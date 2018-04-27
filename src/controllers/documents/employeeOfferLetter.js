const format = require("date-fns/format");
const joi = require("joi");
const path = require("path");
const pug = require("pug");
const uuid = require("short-uuid");

const dbPromise = require(path.join(process.cwd(), "src/db")).dbPromise;
const util = require(path.join(process.cwd(), "src/util"));

const offerLetterTemplate = pug.compileFile(
  path.join(process.cwd(), "src/templates/OfferLetter.pug")
);

// todo: finish this schema and implement
const generateOfferLetterSchema = joi.object().keys({
  company: joi
    .number()
    .integer()
    .required(),
  companyName: joi.string().required(),
  state: joi
    .string()
    .min(2)
    .max(2)
    .required(),
  stateFull: joi.string().required(),
  logo: joi.string().optional(),
  stockPlanName: joi.string().required(),
  owner: joi
    .number()
    .integer()
    .required(),
  firstName: joi.string().required(),
  lastName: joi.string().required(),
  email: joi
    .string()
    .email()
    .required(),
  jobTitle: joi
    .string()
    .min(2)
    .required(),
  payUnit: joi.string().required(),
  payRate: joi.number().required(),
  equityType: joi.string().required(),
  equityAmount: joi
    .number()
    .integer()
    .allow(null),
  vesting: joi.string().optional(),
  fulltime: joi.string().required(),
  hasBenefits: joi.string().required(),
  supervisorName: joi.string().required(),
  supervisorTitle: joi.string().required(),
  supervisorEmail: joi
    .string()
    .email()
    .required(),
  offerDate: joi.string().required(),
  offerDateFormatted: joi.string().required(),
  respondBy: joi.string().required(),
  respondByFormatted: joi.string().required(),
  previewURL: joi
    .string()
    .uuid()
    .required(),
  status: joi.string().required()
});

//
// generate a new offer letter from the form
//
exports.generateOfferLetter = async (req, res) => {
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
  console.log(company);

  // build offer letter object
  offer = {
    ...company,
    ...offer,
    htmlHash: util.crypto.hash(offer.html),
    previewURL: uuid.uuid(),
    status: "preview",
    offerDateFormatted: format(offer.offerDate, "MMMM D, YYYY"),
    respondByFormatted: format(offer.respondBy, "MMMM D, YYYY")
  };
  validate = joi.validate(offer, generateOfferLetterSchema);
  if (validate.error) {
    return res.status(400).json({});
  }
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
      htmlHash,
      status,
      previewURL
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
    offer.htmlHash,
    offer.status,
    offer.previewURL
  );
  await db.run(
    `
    INSERT INTO offerEvents(
      priority,
      eventType,
      eventURL,
      signatureData,
      eventDataHash,
      userId,
      userIpAddress,
      documentId,
      companyId
    ) VALUES (?,?,?,?,?,?,?,?,?)
  `,
    2,
    "offer_letter_created",
    req.originalUrl,
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

const offerEventsSchema = joi.object().keys({
  priority: joi
    .number()
    .integer()
    .required(),
  eventType: joi.string().required(),
  eventURL: joi
    .string()
    .uri({ allowRelative: true })
    .required(),
  signatureData: joi.string(),
  eventDataHash: joi.string().required(),
  documentId: joi
    .number()
    .integer()
    .required(),
  // todo: actual IP address validation
  userIpAddress: joi.string().required(),
  companyId: joi
    .number()
    .integer()
    .required()
});

exports.getOfferLetter = async (req, res) => {
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
  if (!letter) return res.status(404).json({});
  const event = {
    priority: 3,
    eventType: "offer_letter_viewed",
    eventURL: req.originalUrl,
    documentId: letter.id,
    eventDataHash: util.crypto.hash(letter.html),
    // todo: IP logging
    userIpAddress: "fake address",
    companyId: letter.company
  };
  const validate = joi.validate(event, offerEventsSchema, {
    allowUnknown: true
  });
  if (validate.error)
    return res
      .status(500)
      .json({ error: "Issue logging access, Support team has been notified." });
  await db.run(
    `
    INSERT INTO offerEvents(
      priority,
      eventType,
      eventURL,
      documentID,
      eventDataHash,
      userIpAddress,
      companyId
    ) VALUES (?,?,?,?,?,?,?)
    `,
    event.priority,
    event.eventType,
    event.eventURL,
    event.documentID,
    event.eventDataHash,
    event.userIpAddress,
    event.companyId
  );
  // never let signer IDs hit the wire unless intended – allows for bad signing!
  const { previewURL, companyURL, employeeURL, ...cleanLetter } = letter;
  if (id === previewURL) cleanLetter.previewURL = previewURL;
  if (id === companyURL) cleanLetter.companyURL = companyURL;
  if (id === employeeURL) cleanLetter.employeeURL = employeeURL;

  return res.json(cleanLetter);
};

exports.deleteOfferLetter = async (req, res) => {
  const user = req.user;
  const offerId = req.params.id;
  if (!offerId)
    return res.status(400).json({ error: "Invalid offer letter ID" });
  const db = await dbPromise;
  const request = await db.run(
    `
    DELETE FROM offers
    WHERE id = ?
    AND company = ?
    AND status IN ('preview', 'awaiting_company_signature')
  `,
    offerId,
    user.companyId
  );
  if (request.changes === 0) {
    return res.status(401).json({ error: "Unable to delete record" });
  }
  res.json({});
};

exports.confirmOfferLetter = async (req, res) => {
  const user = req.user;
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
  if (!letter) return res.status(404).json({});
  if (letter.companyURL)
    return res.status(401).json({
      error: "This letter has already been confirmed"
    });
  const companyURL = uuid.uuid();
  const confirmLetter = await db.run(
    `
    UPDATE offers
      SET status = 'awaiting_company_signature', companyURL = ?
      WHERE previewURL = ?
      AND status = 'preview'`,
    companyURL,
    id
  );
  if (!confirmLetter.changes) {
    return res.status(400).json({ error: "Invalid status change" });
  }
  const log = await db.run(
    `
    INSERT INTO offerEvents(
      priority,
      eventType,
      eventURL,
      eventDataHash,
      userId,
      userIpAddress,
      companyId,
      documentId
    ) VALUES (?,?,?,?,?,?,?,?)
  `,
    1,
    "offer_letter_sent_to_company",
    req.originalUrl,
    util.crypto.hash(letter.html),
    user.id,
    "fake address",
    letter.company,
    letter.id
  );
  if (!log.changes) {
    console.log("LOGGING ERROR!");
  }
  res.json({ status: "ok" });
};
const signOfferLetterSchema = joi.object().keys({
  documentId: joi
    .string()
    .uuid()
    .required(),
  html: joi.string().required(),
  signature: joi
    .string()
    .required()
    .regex(/^data:image\/(svg\+xml|svg)/)
});
exports.signOfferLetter = async (req, res) => {
  // add signature to master document object and advance status
  const validate = joi.validate(req.body, signOfferLetterSchema);
  if (validate.error) return res.status(400).json({});
  const { documentId, html, signature } = req.body;

  const db = await dbPromise;
  const offerLetter = await db.get(
    `
    SELECT
      id,
      company,
      status,
      companyURL,
      companySignature,
      employeeURL,
      employeeSignature,
      htmlHash
    FROM offers
    WHERE (
      companyURL = ? OR employeeURL = ?
    )
  `,
    documentId,
    documentId
  );
  if (!offerLetter) return res.status(404).json({});
  const event = {
    priority: 1,
    eventURL: req.originalUrl,
    signatureData: signature,
    eventDataHash: util.crypto.hash(html),
    userIpAddress: "fake address",
    documentId: offerLetter.id,
    companyId: offerLetter.company
  };
  if (
    offerLetter.status === "awaiting_company_signature" &&
    documentId === offerLetter.companyURL &&
    offerLetter.companySignature === null
  ) {
    event.eventType = "offer_letter_signed_company";
    const validated = joi.validate(event, offerEventsSchema);
    if (validated.error) {
      return res.status(400).json({});
    }
    const writeSignatureEvent = await db.run(
      `
      UPDATE offers
        SET status = ?, companySignature = ?, employeeURL = ?
        WHERE id = ?
    `,
      "awaiting_employee_signature",
      signature,
      uuid.uuid(),
      offerLetter.id
    );
    if (!writeSignatureEvent.changes) {
      return res.status(400).json({});
    }

    console.log(validated);
    const signatureEventUpdate = await db.run(
      `
      INSERT INTO offerEvents(
        priority,
        eventType,
        eventURL,
        signatureData,
        eventDataHash,
        userIpAddress,
        documentId,
        companyId
      ) VALUES (?,?,?,?,?,?,?,?)
    `,
      event.priority,
      event.eventType,
      event.eventURL,
      event.signatureData,
      event.eventDataHash,
      event.userIpAddress,
      event.documentId,
      event.companyId
    );
    if (!signatureEventUpdate.changes) {
      // todo: alert to admin
      console.log("Error writing event!");
    }
    return res.json({ status: "ok" });
  }
  if (
    offerLetter.status === "awaiting_employee_signature" &&
    documentId === offerLetter.employeeURL &&
    offerLetter.employeeSignature === null
  ) {
    event.eventType = "offer_letter_signed_employee";
    const validated = joi.validate(event, offerEventsSchema);
    if (validated.error) {
      return res.status(400).json({});
    }
    await db.run(
      `
      UPDATE offers
        SET status = ?, employeeSignature = ?
        WHERE id = ?
    `,
      "done",
      signature,
      offerLetter.id
    );
    await db.run(
      `
      INSERT INTO offerEvents(
        priority,
        eventType,
        eventURL,
        signatureData,
        eventDataHash,
        userIpAddress,
        documentId,
        companyId
      ) VALUES (?,?,?,?,?,?,?,?)
    `,
      event.priority,
      event.eventType,
      event.eventURL,
      event.signatureData,
      event.eventDataHash,
      event.userIpAddress,
      event.documentId,
      event.companyId
    );
    return res.json({});
  }
  return res.status(400).json({ error: "Invalid signing!" });
};

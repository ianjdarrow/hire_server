const format = require("date-fns/format");
const joi = require("joi");
const path = require("path");
const pug = require("pug");
const uuid = require("short-uuid");

const dbPromise = require(path.join(process.cwd(), "src/db")).dbPromise;

const mail = require("../../mail");
const util = require(path.join(process.cwd(), "src/util"));

const offerLetterTemplate = pug.compileFile(
  path.join(process.cwd(), "src/templates/OfferLetter.pug")
);

exports.initializeOfferLetter = async (req, res) => {
  const { companyId, email } = req.user;
  const db = await dbPromise;
  const existing = await db.get(
    `
    SELECT previewURL
    FROM offers
    WHERE initialized = 0
    AND companyId = ?
    `,
    companyId
  );
  if (existing) return res.json({ previewURL: existing.previewURL });

  const previewURL = uuid.uuid();
  const initialize = await db.run(
    `
    INSERT INTO offers (previewURL, companyId, owner)
    VALUES (?,?, (SELECT id FROM users WHERE email = ?))
  `,
    previewURL,
    companyId,
    email
  );
  console.log(initialize);

  res.json({ previewURL });
};

const generateOfferLetterSchema = joi.object().keys({
  companyId: joi.number().integer(),
  companyName: joi.string().required(),
  stateFull: joi.string().required(),
  logo: joi.string().allow(""),
  stockPlanName: joi
    .string()
    .required()
    .allow(null),
  owner: joi
    .number()
    .integer()
    .required(),
  firstName: joi
    .string()
    .required()
    .allow(""),
  lastName: joi
    .string()
    .required()
    .allow(""),
  email: joi
    .string()
    .email()
    .required()
    .allow(""),
  jobTitle: joi
    .string()
    .required()
    .allow(""),
  payUnit: joi.string().required(),
  payRate: joi
    .number()
    .required()
    .allow(null),
  equityGrant: joi
    .string()
    .required()
    .allow(null),
  equityType: joi.string().required(),
  equityAmount: joi
    .number()
    .integer()
    .allow(null),
  vesting: joi.string().optional(),
  fulltime: joi.string().required(),
  hasBenefits: joi.string().required(),
  supervisorName: joi
    .string()
    .required()
    .allow(""),
  supervisorTitle: joi
    .string()
    .required()
    .allow(""),
  supervisorEmail: joi
    .string()
    .email()
    .required()
    .allow(""),
  offerDate: joi
    .string()
    .required()
    .allow(""),
  offerDateFormatted: joi.string().required(),
  respondBy: joi
    .string()
    .required()
    .allow(""),
  respondByFormatted: joi.string().required(),
  startDate: joi
    .string()
    .required()
    .allow(""),
  startDateFormatted: joi.string().required(),
  previewURL: joi
    .string()
    .uuid()
    .required(),
  status: joi.string().required()
});

//
// generate a new offer letter from the form
//
exports.updateOfferLetter = async (req, res) => {
  // get company data from user auth info
  let offer = req.body.form;
  let { email } = req.user;
  const db = await dbPromise;
  const company = await db.get(
    `
    SELECT
      c.name as companyName,
      c.state,
      c.stateFull,
      c.logo,
      c.stockPlanName,
      u.companyId,
      u.id as owner
    FROM users u
    INNER JOIN companies c
    ON u.companyId = c.id
    WHERE u.email = ?
  `,
    email
  );
  // build offer letter object
  offer = {
    ...offer,
    ...company,
    status: "preview",
    offerDate: new Date().toLocaleString(),
    offerDateFormatted: format(new Date(), "MMMM D, YYYY"),
    respondByFormatted: format(offer.respondBy, "MMMM D, YYYY"),
    startDateFormatted: format(offer.startDate, "MMMM D, YYYY")
  };
  validate = joi.validate(offer, generateOfferLetterSchema, {
    allowUnknown: true
  });
  if (validate.error) {
    console.log(validate.error);
    return res.status(400).json({});
  }
  // offer.html = offerLetterTemplate({ offer });
  // offer.htmlHash = util.crypto.hash(offer.html);
  const hasContent =
    offer.firstName ||
    offer.lastName ||
    offer.email ||
    offer.title ||
    offer.equityGrant ||
    offer.supervisorName ||
    offer.supervisorTitle ||
    offer.supervisorEmail;
  // add to DB
  await db.run(
    `
    UPDATE offers
    SET
      initialized = ?,
      status = ?,
      owner = ?,
      companyId = ?,
      companyName = ?,
      firstName = ?,
      lastName = ?,
      email = ?,
      jobTitle = ?,
      payUnit = ?,
      payRate = ?,
      equityGrant = ?,
      equityType = ?,
      equityAmount = ?,
      vesting = ?,
      fulltime = ?,
      hasBenefits = ?,
      supervisorName = ?,
      supervisorTitle = ?,
      supervisorEmail = ?,
      offerDate = ?,
      offerDateFormatted = ?,
      respondBy = ?,
      respondByFormatted = ?,
      startDate = ?,
      startDateFormatted = ?,
      status = ?
    WHERE previewURL = ?`,
    hasContent ? 1 : 0,
    offer.status,
    offer.owner,
    offer.companyId,
    offer.companyName,
    offer.firstName,
    offer.lastName,
    offer.email,
    offer.jobTitle,
    offer.payUnit,
    offer.payRate,
    offer.equityGrant,
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
    offer.startDate,
    offer.startDateFormatted,
    offer.status,
    offer.previewURL
  );
  // await db.run(
  //   `
  //   INSERT INTO offerEvents(
  //     priority,
  //     eventType,
  //     eventURL,
  //     signatureData,
  //     eventDataHash,
  //     userId,
  //     userIpAddress,
  //     documentId,
  //     companyId
  //   ) VALUES (?,?,?,?,?,?,?,?,?)
  // `,
  //   2,
  //   "offer_letter_created",
  //   req.originalUrl,
  //   offer.html,
  //   util.crypto.hash(offer.html),
  //   offer.owner,
  //   "fake address",
  //   offer.id,
  //   offer.company
  // );

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
  // const event = {
  //   priority: 3,
  //   eventType: "offer_letter_viewed",
  //   eventURL: req.originalUrl,
  //   documentId: letter.id,
  //   eventDataHash: util.crypto.hash(letter.html),
  //   // todo: IP logging
  //   userIpAddress: util.getIpAddress(req),
  //   companyId: letter.company
  // };
  // const validate = joi.validate(event, offerEventsSchema, {
  //   allowUnknown: true
  // });
  // if (validate.error)
  //   return res
  //     .status(500)
  //     .json({ error: "Issue logging access, Support team has been notified." });
  // await db.run(
  //   `
  //   INSERT INTO offerEvents(
  //     priority,
  //     eventType,
  //     eventURL,
  //     documentID,
  //     eventDataHash,
  //     userIpAddress,
  //     companyId
  //   ) VALUES (?,?,?,?,?,?,?)
  //   `,
  //   event.priority,
  //   event.eventType,
  //   event.eventURL,
  //   event.documentID,
  //   event.eventDataHash,
  //   event.userIpAddress,
  //   event.companyId
  // );
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
    const writeSignatureEvent = await db.run(
      `
      UPDATE offers
        SET status = ?, employeeSignature = ?
        WHERE id = ?
    `,
      "done",
      signature,
      offerLetter.id
    );
    if (!writeSignatureEvent.changes) {
      return res.status(400).json({});
    }
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
    return res.json({});
  }
  return res.status(400).json({ error: "Invalid signing!" });
};

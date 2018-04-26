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
  firstName: joi
    .string()
    .alphanum()
    .min(2)
    .required(),
  lastName: joi
    .string()
    .alphanum()
    .min(2)
    .required(),
  email: joi
    .string()
    .email()
    .required(),
  jobTitle: joi
    .string()
    .alphanum()
    .min(2)
    .required()
});

//
// generate a new offer letter from the form
//
exports.generateOfferLetter = async (req, res) => {
  // get company data from user auth info
  if (!req.user)
    return res.status(401).json({ error: "This route is authenticated" });
  let offer = req.body.offer;
  console.log(req.body);
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
  eventData: joi.string().required(),
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
    eventData: letter.html,
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
      eventData,
      eventDataHash,
      userIpAddress,
      companyId
    ) VALUES (?,?,?,?,?,?,?,?)
    `,
    event.priority,
    event.eventType,
    event.eventURL,
    event.documentID,
    event.eventData,
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

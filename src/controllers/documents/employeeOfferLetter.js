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

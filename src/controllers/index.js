const path = require("path");
const pug = require("pug");
const uuid = require("short-uuid");
const format = require("date-fns/format");

let offerLetters = {};
const offerLetterTemplate = pug.compileFile(
  path.join(process.cwd(), "src/templates/OfferLetter.pug")
);

// initialize mock offer letter and add to janky store
const options = require(path.join(process.cwd(), "src/util/mocks.js"))
  .mockOfferLetter;
const offerLetter = offerLetterTemplate(options);
offerLetters[options.offer.id] = { html: offerLetter, options };

const getIndex = (req, res) => {
  res.json(offerLetters["a"]);
};
const getOfferLetter = (req, res) => {
  const id = req.params.id;
  if (!id in offerLetters)
    return res.status(404).json({ error: "no such key" });
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
  getOfferLetter,
  previewOfferLetter,
  generateOfferLetter,
  signOfferLetter
};

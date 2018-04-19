const path = require("path");
const pug = require("pug");
const uuid = require("short-uuid");

let offerLetters = {};
const options = require(path.join(process.cwd(), "src/util/mocks.js"))
  .mockOfferLetter;

const offerLetterTemplate = pug.compileFile(
  path.join(process.cwd(), "src/templates/OfferLetter.pug")
);

const getIndex = (req, res) => {
  const offerLetter = offerLetterTemplate(options);
  res.json({
    offerLetter,
    options
  });
};
const getOfferLetter = (req, res) => {
  const id = req.params.id;
  if (!id in offerLetters)
    return res.status(404).json({ error: "no such key" });
  return res.json(offerLetters[id]);
};
const generateOfferLetter = (req, res) => {
  let customOptions = {
    offer: {
      companyHasSigned: false,
      employeeHasSigned: false,
      ...req.body
    },
    company: { ...options.company }
  };
  const offerLetter = offerLetterTemplate(customOptions);
  const id = uuid.uuid();
  offerLetters[id] = { offerLetter, options: customOptions };
  return res.json({
    id
  });
};

module.exports = {
  getIndex,
  getOfferLetter,
  generateOfferLetter
};

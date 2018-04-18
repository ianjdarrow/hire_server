const path = require("path");
const pug = require("pug");
const uuid = require("short-uuid");

let offerLetters = {};

const offerLetterTemplate = pug.compileFile(
  path.join(process.cwd(), "src/templates/OfferLetter.pug")
);

const getIndex = (req, res) => {
  const options = require(path.join(process.cwd(), "src/util/mocks.js"))
    .mockOfferLetter;
  const offerLetter = offerLetterTemplate(options);
  // res.send(offerLetter);
  res.json({
    offerLetter,
    options
  });
};

const generateOfferLetter = (req, res) => {
  let options = require(path.join(process.cwd(), "src/util/mocks.js"))
    .mockOfferLetter;
  options.offer = req.body;
  const offerLetter = offerLetterTemplate(options);
  const id = uuid.uuid();
  offerLetters[id] = { offerLetter, options };
  res.json({
    id
  });
};

module.exports = {
  getIndex,
  generateOfferLetter
};

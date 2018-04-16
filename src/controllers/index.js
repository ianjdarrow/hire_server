const path = require("path");
const pug = require("pug");

const offerLetterTemplate = pug.compileFile(
  path.join(process.cwd(), "src/templates/OfferLetter.pug")
);

const getIndex = (req, res) => {
  const options = require(path.join(process.cwd(), "src/util/mocks.js"))
    .mockOfferLetter;
  const offerLetter = offerLetterTemplate(options);
  res.send(offerLetter);
  // res.json({
  //   offerLetter,
  //   options
  // });
};

module.exports = {
  getIndex
};

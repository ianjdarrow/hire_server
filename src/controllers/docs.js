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

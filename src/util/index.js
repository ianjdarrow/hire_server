const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const mockOfferLetter = {
  company: {
    id: "a",
    name: "Summit Labs Inc.",
    logoUrl: `${process.env.ASSET_SERVER}/static/img/dark_logo_transparent.svg`,
    stylesheetUrl: process.env.ASSET_SERVER + "/static/offer-letter.css",
    stockPlanName: "2014 Equity Incentive Plan"
  },
  offer: {
    id: "a",
    status: "awaiting_company_signature",
    firstName: "Ben",
    lastName: "Weisel",
    email: "ben@google.co",
    jobTitle: "Vice President, Engineering",
    payUnit: "year",
    payRate: 160000,
    equityType: "options",
    equityAmount: 90617,
    vesting: "4/none/monthly",
    fulltime: "yes",
    hasBenefits: "yes",
    supervisorName: "Ian Darrow",
    supervisorTitle: "Founder",
    supervisorEmail: "ian@g.co",
    offerDate: "2018-04-16",
    offerDateFormatted: "April 16, 2018",
    respondBy: "2018-04-31",
    respondByFormatted: "April 31, 2018"
  }
};

const hashPassword = pass => {
  return new Promise(res => {
    bcrypt.hash(pass, 9, (err, hash) => {
      return res(hash);
    });
  });
};

const comparePassword = (candidate, hash) => {
  return new Promise(res => {
    bcrypt.compare(candidate, hash, (err, result) => {
      res(result);
    });
  });
};

const generateToken = token => {
  return jwt.sign(token, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "2h"
  });
};

const checkToken = token => {
  return new Promise(res => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"]
      });
      return res(decoded);
    } catch (err) {
      return res(false);
    }
  });
};

module.exports = {
  mockOfferLetter,
  hashPassword,
  comparePassword,
  generateToken,
  checkToken
};

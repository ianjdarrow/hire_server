// import controllers
const auth = require("./auth");
const companies = require("./companies");
const employeeOfferLetter = require("./documents/employeeOfferLetter");

module.exports = {
  // authentication
  login: auth.login,
  signup: auth.signup,
  sendRegistrationLink: auth.sendRegistrationLink,
  confirmRegistration: auth.confirmRegistration,
  checkToken: auth.checkToken,

  // company management
  createCompany: companies.createCompany,
  getCompanyInfo: companies.getCompanyInfo,
  setCompanyInfo: companies.setCompanyInfo,
  getPendingOffers: companies.getPendingOffers,
  getCompanyFeed: companies.getCompanyFeed,
  offerTemplateSearch: companies.offerTemplateSearch,

  // offer letter management
  generateOfferLetter: employeeOfferLetter.generateOfferLetter,
  getOfferLetter: employeeOfferLetter.getOfferLetter,
  confirmOfferLetter: employeeOfferLetter.confirmOfferLetter,
  signOfferLetter: employeeOfferLetter.signOfferLetter,
  deleteOfferLetter: employeeOfferLetter.deleteOfferLetter
};

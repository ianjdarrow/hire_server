const mockOfferLetter = {
  company: {
    name: "Summit Labs Inc.",
    logoUrl: `${process.env.ASSET_SERVER}/static/img/dark_logo_transparent.svg`,
    stylesheetUrl: `${process.env.ASSET_SERVER}/static/offer-letter.css`,
    stockPlanName: "2014 Equity Incentive Plan"
  },
  offer: {
    firstName: "Ben",
    lastName: "Weisel",
    fullName: "Ben Weisel",
    email: "ben@google.co",
    jobTitle: "Vice President, Engineering",
    payUnit: "year",
    payRate: 160000,
    equityType: "option",
    equityAmount: 90617,
    vesting: "4/none/monthly",
    fulltime: "yes",
    hasBenefits: "yes",
    supervisorName: "Scott Moreland",
    supervisorTitle: "Chief Technology Officer",
    supervisorEmail: "scott@g.co",
    offerDate: "April 16, 2018",
    respondBy: "April 31, 2018"
  }
};

module.exports = {
  mockOfferLetter
};

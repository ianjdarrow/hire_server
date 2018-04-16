const mockOfferLetter = {
  company: {
    name: "Summit Labs Inc.",
    logoUrl: `${process.env.ASSET_SERVER}/static/img/dark_logo_transparent.svg`,
    stylesheetUrl: `${process.env.ASSET_SERVER}/static/offer-letter.css`,
    address1: "810 7th Street NE",
    address2: "2nd Floor",
    city: "Washington",
    state: "DC",
    stateFull: "District of Columbia",
    zip: "20002",
    stockPlanName: "2014 Equity Incentive Plan"
  },
  position: {
    title: "Vice President, Engineering",
    description: "the overall development of the Company's technology systems",
    supervisorTitle: "Chief Technology Officer",
    supervisorName: "Scott Moreland",
    isFullTime: true,
    isSalaried: true,
    hasBenefits: true,
    hasEquityGrant: true,
    equityGrantType: "option"
  },
  offer: {
    firstName: "Ben",
    lastName: "Weisel",
    fullName: "Ben Weisel",
    address1: "458 Fake Street",
    address2: "Apt 7D",
    city: "Denver",
    state: "CO",
    stateFull: "Colorado",
    zip: "73233",
    payRate: 160000,
    equityGrantAmount: 90617,
    offerDate: "April 16, 2018",
    offerExpirationDate: "April 31, 2018",
    lastStartDate: "May 31, 2018"
  }
};

module.exports = {
  mockOfferLetter
};

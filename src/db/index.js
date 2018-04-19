const sqlite = require("sqlite");
const path = require("path");

const dbPromise = sqlite.open(path.join(process.cwd(), "/src/db/database.db"), {
  Promise
});

const initDB = async () => {
  const db = await dbPromise;
  const createUsersTable = `
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE,
    companyId INTEGER,
    firstName TEXT,
    lastName TEXT,
    passwordHash TEXT
  );`;
  const createCompaniesTable = `
  CREATE TABLE IF NOT EXISTS companies(
    id INTEGER PRIMARY KEY,
    name TEXT,
    logoUrl TEXT,
    stylesheetUrl TEXT,
    owner INTEGER,
    stockPlanName TEXT
  );`;
  const createOffersTable = `
  CREATE TABLE IF NOT EXISTS offers(
    id INTEGER PRIMARY KEY,
    status TEXT,
    firstName TEXT,
    lastName TEXT,
    email TEXT,
    jobTitle TEXT,
    payUnit TEXT,
    payRate INTEGER,
    equityType TEXT,
    equityAmount INTEGER,
    vesting TEXT,
    fulltime TEXT,
    hasBenefits TEXT,
    supervisorName TEXT,
    supervisorEmail TEXT,
    offerDate TEXT,
    offerDateFormatted TEXT,
    respondBy TEXT,
    respondByFormatted TEXT,
    next TEXT
  );`;

  await Promise.all([
    db.run(createUsersTable),
    db.run(createCompaniesTable),
    db.run(createOffersTable)
  ]);
  console.log("Database initialized");
};

module.exports = {
  dbPromise,
  initDB
};

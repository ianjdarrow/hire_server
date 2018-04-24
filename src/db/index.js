const sqlite = require("sqlite");
const path = require("path");

const dbPromise = sqlite.open(path.join(process.cwd(), "/src/db/database.db"), {
  Promise
});

const initDB = async () => {
  const db = await dbPromise;
  const createCompaniesTable = `
    CREATE TABLE IF NOT EXISTS companies(
      id INTEGER PRIMARY KEY,
      created TIMESTAMP DEFAULT (datetime('now', 'localtime')),
      name TEXT NOT NULL,
      state TEXT DEFAULT 'DE',
      stateFull TEXT default 'Delaware',
      logo TEXT,
      stockPlanName TEXT,
      accountLevel TEXT,
      owner INTEGER,
      isActive INTEGER,
      hasProvidedData INTEGER DEFAULT 0
    );`;
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE,
      firstName TEXT,
      lastName TEXT,
      title TEXT,
      passwordHash TEXT,
      hasRegistered INTEGER,
      isActive INTEGER,
      isAdministrator INTEGER,
      companyId INTEGER,
      FOREIGN KEY (companyId) REFERENCES companies(id)
    );`;
  const createOffersTable = `
    CREATE TABLE IF NOT EXISTS offers(
      id INTEGER PRIMARY KEY,
      company INTEGER,
      companyName TEXT,
      owner INTEGER,
      created TIMESTAMP DEFAULT (datetime('now', 'localtime')),
      html TEXT,
      htmlHash TEXT,
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
      supervisorTitle TEXT,
      supervisorEmail TEXT,
      offerDate TEXT,
      offerDateFormatted TEXT,
      respondBy TEXT,
      respondByFormatted TEXT,
      previewURL TEXT,
      companyURL TEXT,
      companySignature TEXT,
      employeeURL TEXT,
      employeeSignature TEXT
    );`;
  const createOfferEventsTable = `
    CREATE TABLE IF NOT EXISTS offerEvents(
      id INTEGER PRIMARY KEY,
      eventType TEXT,
      eventTime DATETIME DEFAULT (datetime('now', 'localtime')),
      eventURL TEXT,
      userId INTEGER,
      userIpAddress TEXT,
      documentId INTEGER,
      companyId INTEGER NOT NULL
    );
  `;

  await Promise.all([
    db.run(createCompaniesTable),
    db.run(createUsersTable),
    db.run(createOffersTable),
    db.run(createOfferEventsTable)
  ]);
  console.log("Database initialized");
};

module.exports = {
  dbPromise,
  initDB
};

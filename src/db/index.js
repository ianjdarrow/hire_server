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
      created TIMESTAMP DEFAULT (datetime('now')),
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
      resetToken TEXT,
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
      cancelled INTEGER DEFAULT 0,
      created TIMESTAMP DEFAULT (datetime('now')),
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
      created DATETIME DEFAULT (datetime('now')),
      priority INTEGER REQUIRED,
      eventType TEXT REQUIRED,
      signatureData TEXT,
      eventDataHash TEXT REQUIRED,
      eventURL TEXT REQUIRED,
      userId INTEGER,
      userIpAddress TEXT,
      companyId INTEGER,
      documentId INTEGER,
      FOREIGN KEY (documentId) REFERENCES offers(id),
      FOREIGN KEY (companyId) REFERENCES companies(id)
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

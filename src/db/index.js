const sqlite3 = require("sqlite3");
const path = require("path");

const initDB = () => {
  const db = new sqlite3.Database(
    path.join(process.cwd(), "/src/db/database.db")
  );
  console.log(db);
};

module.exports = {
  initDB
};

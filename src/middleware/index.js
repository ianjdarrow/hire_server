const util = require("../util");
const dbPromise = require("../db").dbPromise;

const logger = (req, res, next) => {
  req.startTime = new Date();
  res.on("finish", () => {
    console.log(
      `SERVE ${req.originalUrl} | ${new Date() - req.startTime}ms | ${
        res.statusCode
      }`
    );
  });
  next();
};

const checkToken = async (req, res, next) => {
  const authHeader = req.headers.authentication.split(" ");
  const token = authHeader.length === 2 ? authHeader[1] : null;
  if (token) {
    const validToken = await util.checkToken(token);
    if (validToken) {
      const email = validToken.email;
      const db = await dbPromise;
      const claims = await db.get(
        `
        SELECT
          u.id,
          u.email,
          u.passwordHash,
          u.title,
          u.firstName,
          u.lastName,
          u.isAdministrator,
          c.id AS companyId,
          c.name AS companyName,
          c.hasProvidedData
        FROM users u
        INNER JOIN companies c
        ON u.companyId = c.id
        WHERE u.email = ?;
      `,
        email
      );
      const newToken = util.generateToken(claims);
      req.user = { token: newToken, ...claims };
    }
  }
  // await new Promise(res => setTimeout(res, 100));
  next();
};

module.exports = {
  logger,
  checkToken
};

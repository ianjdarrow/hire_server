const dbPromise = require("../db").dbPromise;
const format = require("date-fns/format");
const util = require("../util");

exports.logger = (req, res, next) => {
  req.startTime = new Date();
  res.on("finish", () => {
    const now = format(new Date(), "M-D HH:mm:ss");
    const elapsed = new Date() - req.startTime;
    console.log(
      `${now}\t${req.method} ${req.originalUrl} | ${elapsed}ms | ${
        res.statusCode
      }`
    );
  });
  next();
};

exports.validateToken = async (req, res, next) => {
  const hdr = req.headers.authentication;
  if (!hdr) return next();
  const authHeader = hdr.split(" ");
  const token = authHeader.length === 2 ? authHeader[1] : null;
  if (token) {
    const validToken = await util.validateToken(token);
    if (validToken) {
      const email = validToken.email;
      const db = await dbPromise;
      const claims = await db.get(
        `
        SELECT
          u.email,
          u.title,
          u.name,
          u.isAdministrator,
          u.hasRegistered,
          c.id AS companyId,
          c.name AS companyName
        FROM users u
        LEFT JOIN companies c
        ON u.companyId = c.id
        WHERE u.email = ?;
      `,
        email
      );
      const newToken = util.signToken(claims);
      req.user = { token: newToken, ...claims };
    }
  }
  // await new Promise(res => setTimeout(res, 100));
  next();
};

exports.requireUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({});
  }
  next();
};

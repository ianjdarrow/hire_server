const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPromise = require("../db").dbPromise;

exports.crypto = require("./crypto");

exports.hashPassword = pass => {
  return new Promise(res => {
    bcrypt.hash(pass, 9, (err, hash) => {
      return res(hash);
    });
  });
};

exports.comparePassword = (candidate, hash) => {
  return new Promise(res => {
    bcrypt.compare(candidate, hash, (err, result) => {
      res(result);
    });
  });
};

exports.getUser = email => {
  return new Promise(async res => {
    const db = await dbPromise;
    const claims = await db.get(
      `
      SELECT
        u.email,
        u.passwordHash,
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
    res(claims);
  });
};

exports.signToken = token => {
  // just in case
  try {
    delete token.passwordHash;
  } catch (err) {}
  return jwt.sign(token, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "30m"
  });
};

exports.validateToken = token => {
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

// todo: add IP logging
exports.getIpAddress = req => {
  return "fake IP";
};

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const crypto = require("./crypto");

const hashPassword = pass => {
  return new Promise(res => {
    bcrypt.hash(pass, 9, (err, hash) => {
      return res(hash);
    });
  });
};

const comparePassword = (candidate, hash) => {
  return new Promise(res => {
    bcrypt.compare(candidate, hash, (err, result) => {
      res(result);
    });
  });
};

const generateToken = token => {
  return jwt.sign(token, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "30m"
  });
};

const checkToken = token => {
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

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  checkToken
};

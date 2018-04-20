const util = require("../util");

const logger = (req, res, next) => {
  req.startTime = new Date();
  res.on("finish", () => {
    console.log(`SERVE ${req.originalUrl} | ${new Date() - req.startTime}ms`);
  });
  next();
};

const checkToken = async (req, res, next) => {
  const token = req.cookies["Authorization"];
  if (token) {
    const validToken = await util.checkToken(token);
    if (validToken) {
      const { iat, exp, ...strippedToken } = validToken;
      const newToken = util.generateToken(strippedToken);
      res.cookie("Authorization", newToken);
      req.user = strippedToken;
    }
  }
  next();
};

module.exports = {
  logger,
  checkToken
};

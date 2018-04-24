const util = require("../util");

const logger = (req, res, next) => {
  req.startTime = new Date();
  res.on("finish", () => {
    console.log(`SERVE ${req.originalUrl} | ${new Date() - req.startTime}ms`);
  });
  next();
};

const checkToken = async (req, res, next) => {
  const token = req.body.user && req.body.user.token;
  if (token) {
    const validToken = await util.checkToken(token);
    if (validToken) {
      const { iat, exp, ...tokenClaims } = validToken;
      const newToken = util.generateToken(tokenClaims);
      req.user = { token: newToken, ...tokenClaims };
    }
  }
  await new Promise(res => setTimeout(res, 50));
  next();
};

module.exports = {
  logger,
  checkToken
};

const logger = (req, res, next) => {
  req.startTime = new Date();
  res.on("finish", () => {
    console.log(`SERVE ${req.originalUrl} | ${new Date() - req.startTime}ms`);
  });
  next();
};

module.exports = {
  logger
};

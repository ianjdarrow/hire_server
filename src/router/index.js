const express = require("express");
const controllers = require("../controllers");
const middleware = require("../middleware");

const router = express.Router();

router.use(middleware.logger);
router.get("/", controllers.getIndex);
router.post("/generate-offer-letter", controllers.generateOfferLetter);

module.exports = router;

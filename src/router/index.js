const express = require("express");
const controllers = require("../controllers");
const middleware = require("../middleware");

const router = express.Router();

router.use(middleware.logger);
router.get("/", controllers.getIndex);
router.get("/offer-letter/:id", controllers.getOfferLetter);
router.post("/preview-offer-letter", controllers.previewOfferLetter);
router.post("/generate-offer-letter", controllers.generateOfferLetter);
router.post("/sign-offer-letter", controllers.signOfferLetter);

module.exports = router;

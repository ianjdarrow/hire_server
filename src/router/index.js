const express = require("express");
const controllers = require("../controllers");
const middleware = require("../middleware");

const router = express.Router();

router.use(middleware.logger);
router.use(middleware.checkToken);

router.post("/login", controllers.login);
router.post("/check-token", controllers.checkToken);
router.get("/offer-letter/:id", controllers.getOfferLetter);
router.post("/create-company", controllers.createCompany);
router.post("/generate-offer-letter", controllers.generateOfferLetter);
router.post("/confirm-offer-letter/:id", controllers.confirmOfferLetter);
router.post("/sign-offer-letter", controllers.signOfferLetter);

module.exports = router;

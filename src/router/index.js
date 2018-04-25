const express = require("express");
const controllers = require("../controllers");
const middleware = require("../middleware");

const router = express.Router();

router.use(middleware.logger);
router.use(middleware.checkToken);

// authentication
router.post("/login", controllers.login);
router.get("/check-token", controllers.checkToken);

// company management
router.post("/create-company", controllers.createCompany);
router.get("/company-info", controllers.getCompanyInfo);
router.post("/company-info", controllers.setCompanyInfo);
router.get("/pending-offers", controllers.getPendingOffers);
router.get("/feed", controllers.getRecentEvents);

// offer letter generation and utilities
router.post("/generate-offer-letter", controllers.generateOfferLetter);
router.get("/template-autocomplete", controllers.getTemplateAutocomplete);
router.get("/confirm-offer-letter/:id", controllers.confirmOfferLetter);
router.get("/offer-letter/:id", controllers.getOfferLetter);
router.post("/sign-offer-letter", controllers.signOfferLetter);
router.delete("/offer-letter/:id", controllers.deleteOfferLetter);

module.exports = router;

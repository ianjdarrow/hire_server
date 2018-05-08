const express = require("express");
const controllers = require("../controllers");
const mw = require("../middleware");

const router = express.Router();

router.use(mw.logger);
router.use(mw.validateToken);

// authentication
router.post("/login", controllers.login);
router.post("/signup", controllers.signup);
router.get("/send-registration-link", controllers.sendRegistrationLink);
router.get("/confirm-registration/:id", controllers.confirmRegistration);
router.get("/check-token", mw.requireUser, controllers.checkToken);

// user management
router.post("/user", mw.requireUser, controllers.setUserInfo);

// company management
router.post("/create-company", mw.requireUser, controllers.createCompany);
router
  .route("/company-info")
  .get(mw.requireUser, controllers.getCompanyInfo)
  .post(mw.requireUser, controllers.setCompanyInfo);
router.get("/pending-offers", mw.requireUser, controllers.getPendingOffers);
router.get("/feed", mw.requireUser, controllers.getCompanyFeed);

// offer letter generation and utilities
router.get(
  "/initialize-offer-letter",
  mw.requireUser,
  controllers.initializeOfferLetter
);
router.post(
  "/update-offer-letter",
  mw.requireUser,
  controllers.updateOfferLetter
);
router.get(
  "/offer-template-search",
  mw.requireUser,
  controllers.offerTemplateSearch
);
router.get(
  "/confirm-offer-letter/:id",
  mw.requireUser,
  controllers.confirmOfferLetter
);
router
  .route("/offer-letter/:id")
  .get(controllers.getOfferLetter)
  .delete(mw.requireUser, controllers.deleteOfferLetter);
router.post("/sign-offer-letter", controllers.signOfferLetter);

module.exports = router;

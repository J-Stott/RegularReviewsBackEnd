const express = require("express");
const homeController = require("../controllers/home-controller");
const { check } = require("express-validator");
const TokenBlacklist = require("../models/token-blacklist");
const {authorizeUser} = require("../helpers/jwt-helpers");

const router = express.Router();

router.get("/index/:index", homeController.home);

router.post(
  "/register",
  [
    check("username").not().isEmpty(),
    check("email").normalizeEmail().isEmail(),
    check("password").isLength(8),
  ],
  homeController.registerUser
);

router.post(
  "/login",
  [check("username").not().isEmpty(), check("password").isLength(8)],
  homeController.loginUser
);

router.get(
  "/logout",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  homeController.logoutUser
);

router.post(
  "/reset/:token",
  homeController.resetPassword
);

router.post(
  "/forgot",
  homeController.forgotPassword
);

router.get(
  "/reset/:token",
  homeController.checkResetToken
);

router.post(
  "/reset/:token",
  homeController.resetPassword
);

module.exports = router;

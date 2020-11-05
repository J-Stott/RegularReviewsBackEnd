const express = require("express");
const profileController = require("../controllers/profile-controller");
const avatarUploader = require("../helpers/avatar-uploader");
const TokenBlacklist = require("../models/token-blacklist");
const {authorizeUser} = require("../helpers/jwt-helpers");

const router = express.Router();

router.get(
  "/:username",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  profileController.getUserProfileData
);

router.delete(
    "/:username",
    authorizeUser,
    TokenBlacklist.checkForBlacklistedToken,
    profileController.deleteUser
  );

router.post(
  "/:username/updateAvatar",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  avatarUploader.upload.single("avatar"),
  profileController.updateAvatar
);

router.post(
  "/:username/updateInfo",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  profileController.updateInfo
);

router.post(
    "/:username/updatePassword",
    authorizeUser,
    TokenBlacklist.checkForBlacklistedToken,
    profileController.updatePassword
  );

module.exports = router;

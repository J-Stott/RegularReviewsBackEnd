//Draft Routes

const express = require("express");
const draftsController = require("../controllers/drafts-controller");
const TokenBlacklist = require("../models/token-blacklist");
const {authorizeUser} = require("../helpers/jwt-helpers");

const router = express.Router();

router.get(
  "/:username",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  draftsController.getUserDrafts
);

router.post(
  "/create",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  draftsController.createDraft
);

router.get(
  "/:draftId/edit",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  draftsController.getDraftData
);

router.patch(
  "/:draftId",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  draftsController.updateDraft
);

router.delete(
  "/:draftId",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  draftsController.deleteDraft
);

module.exports = router;

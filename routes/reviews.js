const express = require("express");
const reviewsController = require("../controllers/reviews-controller");
const TokenBlacklist = require("../models/token-blacklist");
const { authorizeUser } = require("../helpers/jwt-helpers");

const router = express.Router();

router.get("/:reviewId", reviewsController.getReviewData);

router.post(
  "/create",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  reviewsController.createReview
);

router.get(
  "/create/:linkName",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  reviewsController.setupGameData
);

router.patch(
  "/:reviewId",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  reviewsController.updateReview
);

router.delete(
  "/:reviewId",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  reviewsController.deleteReview
);

router.get("/:reviewId/reactions/", reviewsController.getRating);

router.post(
  "/:reviewId/reactions/:reactionName",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  reviewsController.setRating
);

router.get(
  "/:reviewId/comments/:index",
  reviewsController.getComments
);

router.post(
  "/:reviewId/comments/",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  reviewsController.createComment
);

router.patch(
  "/:reviewId/comments/:commentId",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  reviewsController.updateComment
);

router.delete(
  "/:reviewId/comments/:commentId",
  authorizeUser,
  TokenBlacklist.checkForBlacklistedToken,
  reviewsController.deleteComment
);

module.exports = router;

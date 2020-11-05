const express = require("express");
const usersController = require("../controllers/users-controller");

const router = express.Router();

router.get("/:username", usersController.getUserData);

router.get("/:username/reviews/:index", usersController.getUserReviewData);

module.exports = router;

const express = require("express");
const gamesController = require("../controllers/games-controller");

const router = express.Router();

router.get("/:gameLink", gamesController.getGamePageData);
router.get("/search/:gameName", gamesController.searchForGames);
router.get("/:gameLink/:index", gamesController.getGameReviews);


router.post("/:gameLink", gamesController.createGameFromSearchResult);

module.exports = router;

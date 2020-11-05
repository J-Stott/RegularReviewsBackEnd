const _ = require("lodash");
const Game = require("../models/game");
const Review = require("../models/review");
const HttpError = require("../helpers/http-error");
const igdb = require("../helpers/igdb-functions");
const settings = require("../settings");

//gets search bar results
const searchForGames = async (req, res, next) => {
  try {
    const gameName = req.params.gameName;
    const searchTerm = _.lowerCase(gameName);

    //const gameData = await igdb.searchForGames(searchTerm);
    let gameData = await igdb.collateDbAndIgdbGames(Game, searchTerm);

    if ("status" in gameData) {
      return HttpError.sendHttpError(
        gameData.statusText,
        gameData.status,
        next
      );
    }

    if (_.isEmpty(gameData)) {
      gameData = [];
    }

    return res.status(200).json(gameData);
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not get game data", 422, next);
  }
};

const createGameFromSearchResult = async (req, res, next) => {
  try {
    const igdbId = req.body.igdbId;

    const game = await Game.findOrCreateGameEntry(igdbId);

    if (game !== null) {
      return res.status(200).json({ message: "go to game page" });
    }
    return HttpError.sendHttpError("Could not get game", 404, next);
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not get game data", 422, next);
  }
};

const getGamePageData = async (req, res, next) => {
  try {
    const gameLink = req.params.gameLink;
    let game = await Game.model.findOne({ linkName: gameLink }).exec();

    if (game === null) {
        return HttpError.sendHttpError("Game not found", 404, next);
    }

    return res.status(200).json({ game });
    
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not get game data", 404, next);
  }
};

const getGameReviews = async (req, res, next) => {
  try {

    const gameLink = req.params.gameLink;
    const index = Number(req.params.index);
    let game = await Game.model.findOne({ linkName: gameLink }).exec();

    if (game === null) {
        return HttpError.sendHttpError("Game not found", 404, next);
    }

    const reviews = await Review.getSetNumberOfReviews({gameId: game._id}, index * settings.NUM_REVIEWS_TO_GET);

    return res.status(200).json({ reviews });
    
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not get game review data", 404, next);
  }
};

module.exports = {
  searchForGames: searchForGames,
  createGameFromSearchResult: createGameFromSearchResult,
  getGamePageData: getGamePageData,
  getGameReviews: getGameReviews
};

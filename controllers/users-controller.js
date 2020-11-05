const _ = require("lodash");
const User = require("../models/user");
const Review = require("../models/review");
const HttpError = require("../helpers/http-error");
const settings = require("../settings");

//gets search bar results
const getUserData = async (req, res, next) => {
  try {
    const username = req.params.username;
    const lowerUsername = _.toLower(username);

    //const gameData = await igdb.searchForGames(searchTerm);
    let user = await User.findUser({ username: lowerUsername });

    if (!user) {
      return HttpError.sendHttpError("This user does not exist", 404, next);
    }

    return res.status(200).json(user);
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not get user data", 422, next);
  }
};

const getUserReviewData = async (req, res, next) => {
  try {
    const index = Number(req.params.index);
    const username = _.toLower(req.params.username);

    const userProfile = await User.findUser({ username: username });

    if (!userProfile) {
      return res.status(404).json({ message: "User not found" });
    }

    const reviews = await Review.getSetNumberOfReviews(
      { author: userProfile._id },
      index * settings.NUM_REVIEWS_TO_GET
    );

    res.status(200).json({reviews});
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not get user review data", 422, next);
  }
};

module.exports = {
  getUserData: getUserData,
  getUserReviewData: getUserReviewData
};

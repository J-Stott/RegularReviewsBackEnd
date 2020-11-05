const mongoose = require("mongoose");
const HttpError = require("../helpers/http-error");

//Allows us to store tokens that have expired due to a user logging out but have not technically expired. Check against this
const tokenBlacklistSchema = new mongoose.Schema({
  token: { type: String },
  expirationTime: {
    type: Date,
    required: true,
    index: { expires: 10 },
  },
});

const tokenBlacklist = mongoose.model("TokenBlacklist", tokenBlacklistSchema);

async function checkForBlacklistedToken(req, res, next) {
  try {
    const token = req.cookies.jwt;

    const found = await tokenBlacklist.findOne({ token: token }).exec();

    if (found) {
      const error = new HttpError("Token has been discarded.", 500);
      return next(error);
    }

    return next();
  } catch (err) {
    console.log(err);
    return next(err);
  }
}

module.exports = {
  model: tokenBlacklist,
  checkForBlacklistedToken: checkForBlacklistedToken,
};

const mongoose = require("mongoose");
const settings = require("../settings");
const igdb = require("../helpers/igdb-functions");
const EventEmitter = require("events");
const Locker = require("../helpers/update-locker");

const bus = new EventEmitter();

//setup game schema
const gameSchema = new mongoose.Schema({
  igdbId: { type: Number },
  linkName: { type: String },
  displayName: { type: String },
  image: { type: String },
  summary: { type: String },
  numReviews: { type: Number, default: 0 },
  releaseDate: { type: Date, default: null },
  ratingAverages: {
    gameplay: { type: Number, default: 0 },
    visuals: { type: Number, default: 0 },
    audio: { type: Number, default: 0 },
    story: { type: Number, default: 0 },
    overall: { type: Number, default: 0 },
  },
});

gameSchema.index({ displayName: "text" });

const Game = mongoose.model("Game", gameSchema);

function getAfterLastSlash(str) {
  const index = str.lastIndexOf("/");
  return str.substring(index + 1);
}

async function findOrCreateGameEntry(idgbId, session = null) {
  //create game data here

  try {
    const key = `GameCreate${idgbId}`;

    if (Locker.exists(key)) {
      await new Promise((resolve) => bus.once("unlocked", resolve));
    }

    Locker.add(key);
    let game = await Game.findOne({ igdbId: idgbId }).exec();

    if (game === null) {
      let gameData = await igdb.findGameByIgdbId(idgbId);

      let imageUrl = settings.DEFAULT_GAME_IMAGE;

      if ("cover" in gameData) {
        imageUrl = gameData.cover.url;
        imageUrl = `https:${imageUrl.replace("t_thumb", "t_cover_big")}`;
      }

      let date = null;
      if ("first_release_date" in gameData) {
        date = new Date(gameData.first_release_date * 1000);
      }

      const linkName = getAfterLastSlash(gameData.url);

      let newGame = new Game({
        igdbId: gameData.id,
        displayName: gameData.name,
        linkName: linkName,
        summary: gameData.summary,
        releaseDate: date,
        image: imageUrl,
      });

      if (session) {
        game = await newGame.save({ session: session });
      } else {
        game = await newGame.save();
      }
    }
    Locker.remove(key);
    bus.emit("unlocked");
    return game;
  } catch (err) {
    console.log("--find or create game error--");
    throw err;
  }
}

//adds to the averages of a game
async function addToAverages(review, session = null) {
  try {
    const key = `AddAverage${review.gameId}`;

    if (Locker.exists(key)) {
      await new Promise((resolve) => bus.once("unlocked", resolve));
    }

    Locker.add(key);
    const ratings = review.ratings;

    let game = await Game.findOne({ _id: review.gameId }).exec();

    Object.keys(game.ratingAverages).forEach(function (key) {
      game.ratingAverages[key] *= game.numReviews;
      game.ratingAverages[key] += ratings[key];
    });

    game.numReviews++;

    Object.keys(game.ratingAverages).forEach(function (key) {
      game.ratingAverages[key] /= game.numReviews;
    });

    if (session) {
      await game.save({ session: session });
    } else {
      await game.save();
    }

    Locker.remove(key);
    bus.emit("unlocked");
  } catch (err) {
    console.log("--add to averages error--");
    throw err;
  }
}

//removes the averages for a game
async function removeFromAverages(review, session = null) {
  try {
    const ratings = review.ratings;

    const key = `RemoveAverage${review.gameId}`;

    if (Locker.exists(key)) {
      await new Promise((resolve) => bus.once("unlocked", resolve));
    }

    Locker.add(key);
    let game = await Game.findOne({ _id: review.gameId }).exec();

    Object.keys(game.ratingAverages).forEach(function (key) {
      game.ratingAverages[key] *= game.numReviews;
      game.ratingAverages[key] -= ratings[key];
    });

    game.numReviews--;

    if (game.numReviews > 1) {
      Object.keys(game.ratingAverages).forEach(function (key) {
        game.ratingAverages[key] /= game.numReviews;
      });
    }

    if (session) {
      await game.save({ session: session });
    } else {
      await game.save();
    }

    Locker.remove(key);
    bus.emit("unlocked");
  } catch (err) {
    console.log("--remove from averages error--");
    throw err;
  }
}

//removes the averages for a game
async function updateAverages(oldReview, newReview, session = null) {
  try {
    const oldRatings = oldReview.ratings;
    const newRatings = newReview.ratings;
    const gameId = oldReview.gameId;

    const key = `updateAverage${gameId}`;

    if (Locker.exists(key)) {
      await new Promise((resolve) => bus.once("unlocked", resolve));
    }

    Locker.add(key);
    let game = await Game.findOne({ _id: gameId }).exec();

    Object.keys(game.ratingAverages).forEach(function (key) {
      game.ratingAverages[key] *= game.numReviews;
      game.ratingAverages[key] -= oldRatings[key];
      game.ratingAverages[key] += newRatings[key];
    });

    if (game.numReviews > 1) {
      Object.keys(game.ratingAverages).forEach(function (key) {
        game.ratingAverages[key] /= game.numReviews;
      });
    }

    if (session) {
      await game.save({ session: session });
    } else {
      await game.save();
    }

    Locker.remove(key);
    bus.emit("unlocked");
  } catch (err) {
    console.log("--update averages error--");
    throw err;
  }
}

module.exports = {
  model: Game,
  findOrCreateGameEntry: findOrCreateGameEntry,
  addToAverages: addToAverages,
  removeFromAverages: removeFromAverages,
  updateAverages: updateAverages,
  getAfterLastSlash: getAfterLastSlash,
};

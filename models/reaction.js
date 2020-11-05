const mongoose = require("mongoose");
const Locker = require("../helpers/update-locker");
const EventEmitter = require("events");

const bus = new EventEmitter();

//setup reaction schema
const reactionSchema = new mongoose.Schema({
  review: { type: mongoose.Schema.Types.ObjectId, ref: "Review" },
  reaction: {
    up: { type: Number, default: 0 },
    down: { type: Number, default: 0 },
    funny: { type: Number, default: 0 },
  },

  userReactions: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      userReaction: {
        up: { type: Number, default: 0 },
        down: { type: Number, default: 0 },
        funny: { type: Number, default: 0 },
      },
    },
  ],
});

const Reaction = mongoose.model("Reaction", reactionSchema);

async function getUserReaction(reaction, userId) {
  try {
    let userReaction = reaction.userReactions.find((data) => {
      return String(data.user) === String(userId);
    });

    if (userReaction === undefined) {
      return null;
    }

    return userReaction;
  } catch (err) {
    throw err;
  }
}

async function increaseReaction(reaction, userReaction, reactionName) {
  try {
    reaction.reaction[reactionName]++;
    userReaction.userReaction[reactionName] = 1;
    reaction.save();
  } catch (err) {
    throw err;
  }
}

async function decreaseReaction(reaction, userReaction, reactionName) {
  try {
    reaction.reaction[reactionName]--;
    userReaction.userReaction[reactionName] = 0;
    reaction.save();
  } catch (err) {
    throw err;
  }
}

async function modifyUpDownReaction(reaction, userReaction, reactionName) {
  try {
    const oppositeReactionName = reactionName === "up" ? "down" : "up";

    reaction.reaction[reactionName]++;
    userReaction.userReaction[reactionName] = 1;

    //reset the opposite reaction to zero if it has been set before by a user
    if (userReaction.userReaction[oppositeReactionName] === 1) {
      reaction.reaction[oppositeReactionName]--;
      userReaction.userReaction[oppositeReactionName] = 0;
    }
    reaction.save();
  } catch (err) {
    throw err;
  }
}

async function updateUserReaction(reviewId, reactionName, userId) {
  try {
    const key = `UpdateReaction${reviewId}`;

    if (Locker.exists(key)) {
      await new Promise((resolve) => bus.once("unlocked", resolve));
    }

    Locker.add(key);

    let reaction = await Reaction.findOne(
      { review: reviewId },
      "reaction userReactions"
    ).exec();

    //check that a reaction exists for the logged in user
    let userReaction = await getUserReaction(reaction, userId);

    if (userReaction === null) {
      //create users reaction, bump appropriate reaction and save
      userReaction = {
        user: userId,
        userReaction: {
          up: 0,
          down: 0,
          funny: 0,
        },
      };

      userReaction.userReaction[reactionName] = 1;
      reaction.userReactions.unshift(userReaction);
      reaction.reaction[reactionName]++;
      await reaction.save();
    } else {
      if (userReaction.userReaction[reactionName] == 0) {
        if (reactionName === "funny") {
          await increaseReaction(reaction, userReaction, reactionName);
        } else {
          await modifyUpDownReaction(reaction, userReaction, reactionName);
        }
      } else {
        await decreaseReaction(reaction, userReaction, reactionName);
      }
    }

    const response = {
      reactions: reaction.reaction,
      userReaction: userReaction.userReaction,
    };

    Locker.remove(key);
    bus.emit("unlocked");
    return response;
  } catch (err) {
    throw err;
  }
}

module.exports = {
  model: Reaction,
  getUserReaction: getUserReaction,
  updateUserReaction: updateUserReaction,
};

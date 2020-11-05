const _ = require("lodash");
const HttpError = require("../helpers/http-error");
const User = require("../models/user");
const avatarUploader = require("../helpers/avatar-uploader");
const Review = require("../models/review");
const Draft = require("../models/draft");
const Discussion = require("../models/discussion");
const Reaction = require("../models/reaction");
const Game = require("../models/game");

const canAccessProfileData = (currentUser, userProfile) => {
  return (
    currentUser.id.toString() === userProfile.id.toString() ||
    User.isAdmin(currentUser)
  );
};

const getUserProfileData = async (req, res, next) => {
  try {
    const userProfile = _.toLower(req.params.username);
    const userData = req.user;

    const currentUser = await User.findUser({ _id: userData.id });
    const foundUser = await User.findUser({ username: userProfile });

    if (!foundUser) {
      return HttpError.sendHttpError("This user does not exist!", 422, next);
    }

    if (!canAccessProfileData(currentUser, foundUser)) {
      return HttpError.sendHttpError(
        "You are trying to get access to profile data that isn't yours! Cheeky!",
        422,
        next
      );
    }

    return res.status(200).json({
      displayName: foundUser.displayName,
      bio: foundUser.bio,
      avatar: foundUser.avatar,
    });
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not access this profile", 422, next);
  }
};

const updateAvatar = async (req, res, next) => {
  try {
    const userProfile = _.toLower(req.params.username);
    const userData = req.user;

    const currentUser = await User.findUser({ _id: userData.id });
    let foundUser = await User.findUser({ username: userProfile });

    if (!canAccessProfileData(currentUser, foundUser)) {
      return HttpError.sendHttpError(
        "You are trying to change the avatar of a user that isn't you!",
        422,
        next
      );
    }

    if (!req.file) {
      return HttpError.sendHttpError(
        "Please provide a valid image file. (.jpeg/.png)",
        422,
        next
      );
    }
    const file = req.file;

    const avatarName = "/uploads/avatars/" + file.filename;

    //delete their previous image from the server
    if (avatarName !== foundUser.avatar) {
      avatarUploader.deleteProfileImage(foundUser);
    }

    foundUser.avatar = avatarName;
    await foundUser.save();
    return res.status(200).json({
      message: "Profile Picture updated successfully!",
      avatar: foundUser.avatar,
    });
  } catch (err) {
    console.log(err);
  }
};

const updateInfo = async (req, res, next) => {
  try {
    const userProfile = _.toLower(req.params.username);
    const userData = req.user;

    const currentUser = await User.findUser({ _id: userData.id });
    let foundUser = await User.findUser({ username: userProfile });

    if (!canAccessProfileData(currentUser, foundUser)) {
      return HttpError.sendHttpError(
        "You are trying to change the info of a user that isn't you!",
        422,
        next
      );
    }

    const displayName = req.body.displayName;
    const bio = req.body.bio;

    //double check they have given us an appropriate name
    const lowerFormName = _.toLower(displayName);

    if (foundUser.username !== lowerFormName) {
      return HttpError.sendHttpError(
        "Your display name does not match your username",
        422,
        next
      );
    }

    if (bio.length > 300) {
      return HttpError.sendHttpError(
        "Your bio is over 300 characters. Please reduce it!",
        422,
        next
      );
    }
    foundUser.displayName = displayName;
    foundUser.bio = bio;
    await foundUser.save();
    return res.status(200).json({
      message: "User profile data updated successfully!",
      displayName: foundUser.displayName,
      bio: foundUser.bio,
    });
  } catch (err) {
    console.log(err);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const userProfile = _.toLower(req.params.username);
    const userData = req.user;

    const currentUser = await User.findUser({ _id: userData.id });
    let foundUser = await User.findUser({ username: userProfile });
    const logout = foundUser._id === currentUser._id;

    if (!canAccessProfileData(currentUser, foundUser)) {
      return HttpError.sendHttpError(
        "You are trying to change the password of a user that isn't you!",
        422,
        next
      );
    }

    foundUser.changePassword(
      req.body.oldPassword,
      req.body.newPassword,
      function (err) {
        if (err) {
          console.log(err);
          return HttpError.sendHttpError(
            "Your old password is incorrect. Please try again",
            422,
            next
          );
        } else {
          res.status(200).json({
            message: "Password updated successfully!",
          });
        }
      }
    );
  } catch (err) {
    console.log(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const userProfile = _.toLower(req.params.username);
    const userData = req.user;

    const currentUser = await User.findUser({ _id: userData.id });
    let foundUser = await User.findUser({ username: userProfile });

    if (!canAccessProfileData(currentUser, foundUser)) {
      return HttpError.sendHttpError(
        "You are trying to change the password of a user that isn't you!",
        422,
        next
      );
    }

    console.log("-- Deleting User --");
    console.log(foundUser);

    //to add later when we implement these models
    let reviews = await Review.model.find({ author: foundUser._id }).exec();

    reviews.forEach((review) => {
      Game.removeFromAverages(review);
      Discussion.model.deleteOne({ review: review._id }).exec();
      Reaction.model.deleteOne({ review: review._id }).exec();
      review.remove();
    });

    await Draft.model.deleteMany({ author: foundUser._id }).exec();

    await Discussion.model
      .updateMany({}, { $pull: { comments: { user: foundUser._id } } })
      .exec();

    const reactions = await Reaction.model
      .find({ "userReactions.user": foundUser._id })
      .exec();

    console.log(reactions);

    reactions.forEach(async (reaction) => {
      console.log(reaction);
      const userReaction = await Reaction.getUserReaction(reaction, foundUser._id);
      console.log(userReaction.userReaction);
      console.log(reaction.reaction);

      for(const [key, value] of Object.entries(userReaction.userReaction)){
        console.log(key, value);
        reaction.reaction[key] -= value;
      }

      reaction.save();
    })

    await Reaction.model
      .updateMany({}, { $pull: { userReactions: { user: foundUser._id } } })
      .exec();

    await foundUser.remove();

    avatarUploader.deleteProfileImage(foundUser);
    res.clearCookie("jwt");

    return res.status(200).json({
      message: "User removed successfully",
      logout: logout
    });
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError(
      "Could not complete user deletion. Please try again.",
      422,
      next
    );
  }
};

module.exports = {
  getUserProfileData: getUserProfileData,
  updateAvatar: updateAvatar,
  updateInfo: updateInfo,
  updatePassword: updatePassword,
  deleteUser: deleteUser,
};

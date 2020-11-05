const _ = require("lodash");
const mongoose = require("mongoose");
const User = require("../models/user");
const Review = require("../models/review");
const Reaction = require("../models/reaction");
const Draft = require("../models/draft");
const Discussion = require("../models/discussion");
const Game = require("../models/game");
const HttpError = require("../helpers/http-error");
const { verifyToken } = require("../helpers/jwt-helpers");
const settings = require("../settings");

//helpers that will determine whether we turn on admin buttons or not

function isAuthor(user, author) {
  return String(user._id) === String(author._id);
}

function setCommentAdminStatus(user, comments) {
  if (user !== null) {
    if (User.isSuperAdmin(user)) {
      comments.forEach((comment) => {
        if (isAuthor(user, comment.user) || !User.isSuperAdmin(comment.user)) {
          comment.admin = true;
        }
      });
    } else if (User.isAdmin(user)) {
      comments.forEach((comment) => {
        if (isAuthor(user, comment.user) || !User.isAdmin(comment.user)) {
          comment.admin = true;
        }
      });
    } else {
      comments.forEach((comment) => {
        if (isAuthor(user, comment.user)) {
          comment.admin = true;
        }
      });
    }
  }
}

function setReviewAdminStatus(user, review) {
  if (user !== null) {
    if (isAuthor(user, review.author)) {
      review.adminStatus = "author";
    } else if (User.isAdmin(user)) {
      review.adminStatus = "admin";
    }
  }
}

const getReviewData = async (req, res, next) => {
  try {
    const reviewId = req.params.reviewId;
    //get all reactions and the specific reaction from the logged in user, if any

    let review = await Review.model
      .findOne({ _id: reviewId })
      .populate({
        path: "author",
        select: ["_id", "avatar", "displayName"],
      })
      .populate({ path: "reactions", select: "reaction -_id" })
      .populate({ path: "gameId", select: "image linkName displayName -_id" })
      .exec();

    if (!review) {
      return HttpError.sendHttpError(
        "This review could not be found",
        404,
        next
      );
    } else {
      const userId = verifyToken(req);
      let user = null;
      if (userId) {
        user = await User.findUser({ _id: userId });
      }

      const reviewData = review.toObject();
      setReviewAdminStatus(user, reviewData);

      const data = {
        review: reviewData,
      };

      res.status(200).json(data);
    }
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not get review data", 422, next);
  }
};

//used when opting creating a review from the game page. Sends that game's data
const setupGameData = async (req, res, next) => {
  try {
    const linkName = req.params.linkName;

    const game = await Game.model.findOne({ linkName: linkName }).exec();

    if (!game) {
      return HttpError.sendHttpError("Could not find game", 422, next);
    }

    return res
      .status(200)
      .json({ gameId: { igdbId: game.igdbId, displayName: game.displayName } });
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not get review data", 422, next);
  }
};

const createReview = async (req, res, next) => {
  let newReaction = null;
  let newDiscussion = null;
  let newReview = null;

  let reviewAveragesUpdated = false;
  let userCountUpdated = false;

  try {
    let user = await User.findUser({ _id: req.user.id });

    const igdbId = Number(req.body.igdbId);
    let game = await Game.findOrCreateGameEntry(igdbId);

    //allow for a 48 hour grace period before a game can be reviewed
    if (game.releaseDate) {
      const reviewDate = new Date(game.releaseDate);
      reviewDate.setDate(reviewDate.getDate() + 2);

      if (Date.now() < reviewDate) {
        return HttpError.sendHttpError(
          "You must wait 48 hours before newly released games can be reviewed.",
          422,
          next
        );
      }
    }

    //find if user has already created a review for this game
    let existingReview = await Review.model
      .findOne({ author: user._id, gameId: game._id })
      .exec();

    if (existingReview) {
      return HttpError.sendHttpError(
        "You have already created a review for this game. Please edit or delete your existing review if you wish to rewrite it.",
        422,
        next
      );
    }

    newReaction = new Reaction.model();
    await newReaction.save();

    const createDiscussion = req.body.discussion;

    if (createDiscussion) {
      newDiscussion = new Discussion.model();
      await newDiscussion.save();
    }

    newReview = await Review.createReview(
      req,
      user,
      game,
      newReaction,
      newDiscussion
    );

    await Game.addToAverages(newReview);
    reviewAveragesUpdated = true;
    await User.updateReviewCount(user._id, true);
    userCountUpdated = true;

    const reviewId = newReview._id;

    //link review to reaction
    newReaction.review = reviewId;
    newReaction.save();

    if (newDiscussion !== null) {
      //link review to discussion
      newDiscussion.review = reviewId;
      newDiscussion.save();
    }

    //remove draft from user and drafts collection
    if (req.body.draftId !== null) {
      await Draft.model.deleteOne({ _id: req.body.draftId }).exec();
    }

    return res
      .status(201)
      .json({ message: "Review created successfully", reviewId: reviewId });
  } catch (err) {
    console.log(err);

    //if we have an error, roll back any of the previous operations
    if (newReaction) {
      await newReaction.remove();
    }

    if (newDiscussion) {
      await newDiscussion.remove();
    }

    if (newReview) {
      if (reviewAveragesUpdated) {
        await Game.removeFromAverages(newReview);
      }

      if (userCountUpdated) {
        await User.updateReviewCount(user._id, false);
      }

      await newReview.remove();
    }
    return HttpError.sendHttpError("Could not create review", 422, next);
  }
};

const updateReview = async (req, res, next) => {
  const session = await mongoose.startSession();
  const reviewId = req.params.reviewId;
  try {
    await session.withTransaction(async () => {
      let oldReview = await Review.model
        .findOne({ _id: reviewId, author: req.user.id })
        .exec();

      let newReview = await Review.model
        .findOne({ _id: reviewId, author: req.user.id })
        .exec();

      newReview = await Review.updateReview(newReview, req, session);

      await Game.updateAverages(oldReview, newReview, session);
    });

    res
      .status(201)
      .json({ message: "Review edited successfully", reviewId: reviewId });
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not edit review", 422, next);
  } finally {
    await session.endSession();
  }
};

const deleteReview = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    let user = await User.findUser({ _id: req.user.id });

    const reviewId = req.params.reviewId;

    //removes review and all review related data from other collections

    let review = null;

    if (User.isAdmin(user)) {
      review = await Review.model.findOne({ _id: reviewId }).exec();
    } else {
      review = await Review.model
        .findOne({ _id: reviewId, author: user._id })
        .exec();
    }

    if (!review) {
      return HttpError.sendHttpError(
        "This review could not be found or you don't have permission to delete this review",
        404,
        next
      );
    }

    session.startTransaction();

    let reviewDelete = null;

    reviewDelete = Review.model
      .deleteOne({ _id: reviewId })
      .session(session)
      .exec();

    let discussionDelete = Discussion.model
      .deleteOne({ review: reviewId })
      .session(session)
      .exec();

    let reactionDelete = Reaction.model
      .deleteOne({ review: reviewId })
      .session(session)
      .exec();

    let userUpdate = User.updateReviewCount(review.author, false, session);

    await Game.removeFromAverages(review, session);
    await reviewDelete;
    await reactionDelete;
    await userUpdate;
    await discussionDelete;

    await session.commitTransaction();

    res
      .status(201)
      .json({ message: "Review deleted successfully", reviewId: reviewId });
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not delete review", 422, next);
  } finally {
    await session.endSession();
  }
};

//gets rating data for review and any relevant user related ratings
const getRating = async (req, res, next) => {
  try {
    const reviewId = req.params.reviewId;

    let reaction = await Reaction.model
      .findOne({ review: reviewId }, "reaction userReactions")
      .exec();

    let userReactionData = null;

    const userId = verifyToken(req);

    if (userId) {
      userReactionData = await Reaction.getUserReaction(reaction, userId);
    }

    let userReaction = null;
    if (userReactionData) {
      userReaction = userReactionData.userReaction;
    }

    const data = {
      reactions: reaction.reaction,
      userReaction: userReaction,
    };

    res.status(200).json(data);
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not update reaction", 422, next);
  }
};

const setRating = async (req, res, next) => {
  try {
    const reviewId = req.params.reviewId;
    const reactionName = req.params.reactionName;

    let review = await Review.model.findOne({ _id: reviewId }).exec();

    if (review.author.toString() === String(req.user.id)) {
      return HttpError.sendHttpError(
        "An author cannot rate their own review",
        422,
        next
      );
    }

    const response = await Reaction.updateUserReaction(
      reviewId,
      reactionName,
      req.user.id
    );

    res.status(200).json(response);
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not update reaction", 422, next);
  }
};

const getComments = async (req, res, next) => {
  try {
    const reviewId = req.params.reviewId;
    const index = req.params.index;

    const userId = verifyToken(req);

    let user = null;

    if(userId) {
      user = await User.findUser({_id: userId});
    }


    let comments = await Discussion.getComments(
      reviewId,
      index * settings.NUM_COMMENTS_TO_GET
    );

    const data = {
      comments: [],
    };

    if (comments) {
      const commentsData = comments.toObject();
      setCommentAdminStatus(user, commentsData);
      data.comments = commentsData;
    }

    res.status(200).json(data);
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not get comments", 422, next);
  }
};

const createComment = async (req, res, next) => {
  try {
    const reviewId = req.params.reviewId;
    const comment = req.body.comment;

    const discussion = await Discussion.addToDiscusssion(
      reviewId,
      req.user.id,
      comment
    );
    
    const commentData = discussion.toObject();
    commentData.admin = true;

    res.status(200).json(commentData);
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not get comments", 422, next);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const reviewId = req.params.reviewId;
    const commentId = req.params.commentId;

    let result = null;

    const user = await User.findUser({_id: req.user.id});

    if (User.isAdmin(user)) {
      result = await Discussion.model
        .updateOne(
          { review: reviewId },
          { $pull: { comments: { _id: commentId } } }
        )
        .exec();
    } else {
      result = await Discussion.model
        .updateOne(
          { review: reviewId },
          { $pull: { comments: { _id: commentId, user: user._id } } }
        )
        .exec();
    }

    res.status(200).json({id: commentId});
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not remove comment", 422, next);
  }
};

const updateComment = async (req, res, next) => {
  try {
    const reviewId = req.params.reviewId;
    const commentId = req.params.commentId;
    const newComment = req.body.comment;

    const user = await User.findUser({_id: req.user.id});

    const doc = await Discussion.model.findOne({ review: reviewId }).exec();
    let comment = doc.comments.id(commentId);

    if (
      !User.isAdmin(user) &&
      String(comment.user) !== String(user._id)
    ) {
      return HttpError.sendHttpError(
        "You are trying to edit a comment that is not yours",
        422,
        next
      );
    }

    comment.comment = newComment;
    await doc.save();


    res.status(200).send(comment);
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not edit comment", 422, next);
  }
};

module.exports = {
  getReviewData: getReviewData,
  setupGameData: setupGameData,
  createReview: createReview,
  updateReview: updateReview,
  deleteReview: deleteReview,
  getRating: getRating,
  setRating: setRating,
  getComments: getComments,
  createComment: createComment,
  deleteComment: deleteComment,
  updateComment: updateComment,
};

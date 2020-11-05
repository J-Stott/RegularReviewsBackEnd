const mongoose = require("mongoose");

const discussionSchema = new mongoose.Schema({
  review: { type: mongoose.Schema.Types.ObjectId, ref: "Review" },
  comments: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      created: { type: Date, default: Date.now },
      edited: { type: Date, default: null },
      comment: { type: String },
    },
  ],
});

const Discussion = mongoose.model("Discussion", discussionSchema);

//adds to the discussion then returns that comment from the collection
async function addToDiscusssion(reviewId, userId, comment) {
  try {
    let discussion = await Discussion.findOne({ review: reviewId }).exec();

    console.log(comment);

    discussion.comments.push({
      user: userId,
      comment: comment,
    });

    discussion = await discussion.save();
    await discussion
      .populate({
        path: "comments",
        populate: {
          path: "user",
          model: "User",
          select: { displayName: 1, avatar: 1, roles: 1 },
        },
      })
      .execPopulate();

    console.log(discussion);

    const userComments = discussion.comments.filter(function (comment) {
      console.log(comment);
      return String(comment.user._id) === String(userId);
    });

    return userComments[userComments.length - 1];
  } catch (err) {
    throw err;
  }
}

async function getComments(reviewId, skip = 0, limit = 20) {
  try {
    const discussion = await Discussion.findOne(
      { review: reviewId },
      { comments: { $slice: [skip, limit] } }
    )
      .populate({
        path: "comments",
        populate: {
          path: "user",
          model: "User",
          select: { displayName: 1, avatar: 1, roles: 1 },
        },
      })
      .exec();

    if (!discussion) {
      return null;
    }

    return discussion.comments;
  } catch (err) {
    throw err;
  }
}

module.exports = {
  model: Discussion,
  addToDiscusssion: addToDiscusssion,
  getComments: getComments,
};

const mongoose = require("mongoose");

//setup review schema
const reviewSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Game",
  },
  ratings: {
    gameplay: { type: Number },
    visuals: { type: Number },
    audio: { type: Number },
    story: { type: Number },
    overall: { type: Number },
  },
  title: { type: String },
  content: { type: String },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  created: { type: Date, default: Date.now },
  edited: { type: Date, default: null },
  reactions: { type: mongoose.Schema.Types.ObjectId, ref: "Reaction" },
  discussion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Discussion",
  },
});

const Review = mongoose.model("Review", reviewSchema);

async function createReview(
  req,
  user,
  game,
  reactions,
  discussion = null,
  session = null,
) {
  try {
    //create new review
    const newReview = new Review({
      author: user._id,
      gameId: game._id,
      ratings: {
        //if user hasn't entered a rating, presume 0
        gameplay: "gameplay" in req.body ? Number(req.body.gameplay) : 0,
        visuals: "visuals" in req.body ? Number(req.body.visuals) : 0,
        audio: "audio" in req.body ? Number(req.body.audio) : 0,
        story: "story" in req.body ? Number(req.body.story) : 0,
        overall: "overall" in req.body ? Number(req.body.overall) : 0,
      },
      title: req.body.title,
      content: req.body.content,
      reactions: reactions._id,
    });

    if (discussion !== null) {
      newReview.discussion = discussion._id;
    }

    let review = null;

    if(session) {
      review = await newReview.save({ session: session });
    } else {
      review = await newReview.save();
    }

    return review;
  } catch (err) {
    console.log("--create review error--");
    throw err;
  }
}

async function updateReview(review, req, session) {
  try {
    //update review
    review.title = req.body.title;
    review.content = req.body.content;
    review.edited = Date.now();
    review.ratings = {
      //if user hasn't entered a rating, presume 0
      gameplay: "gameplay" in req.body ? Number(req.body.gameplay) : 0,
      visuals: "visuals" in req.body ? Number(req.body.visuals) : 0,
      audio: "audio" in req.body ? Number(req.body.audio) : 0,
      story: "story" in req.body ? Number(req.body.story) : 0,
      overall: "overall" in req.body ? Number(req.body.overall) : 0,
    };

    return review.save({ session: session });
  } catch (err) {
    console.log("--update review error--");
    throw err;
  }
}

async function getSetNumberOfReviews(
  findOptions = {},
  skipNumber = 0,
  limit = 10,
  sortBy = {
    created: "desc",
  }
) {
  try {
    return Review.find(findOptions)
      .populate({ path: "gameId", select: "displayName image linkName -_id" })
      .populate({ path: "author", select: "displayName avatar -_id" })
      .sort(sortBy)
      .skip(skipNumber)
      .limit(limit)
      .exec();
  } catch (err) {
    throw err;
  }
}

module.exports = {
  model: Review,
  createReview: createReview,
  updateReview: updateReview,
  getSetNumberOfReviews: getSetNumberOfReviews,
};

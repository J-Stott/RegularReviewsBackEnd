const mongoose = require("mongoose");

//setup draft schema
const draftSchema = new mongoose.Schema({
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
});

const Draft = mongoose.model("Draft", draftSchema);

function createDraft(user, game, req) {
  const newDraft = new Draft({
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
  });

  let draft = newDraft.save();
  return draft;
}

async function updateDraft(draftId, game, req) {
  try {
    let update = Draft.updateOne(
      { _id: draftId, author: req.user.id },
      {
        gameId: game._id,
        title: req.body.title,
        content: req.body.content,
        ratings: {
          //if user hasn't entered a rating, presume 0
          gameplay: "gameplay" in req.body ? Number(req.body.gameplay) : 0,
          visuals: "visuals" in req.body ? Number(req.body.visuals) : 0,
          audio: "audio" in req.body ? Number(req.body.audio) : 0,
          story: "story" in req.body ? Number(req.body.story) : 0,
          overall: "overall" in req.body ? Number(req.body.overall) : 0,
        },
      }
    ).exec();

    return update;
  } catch (err) {
    throw err;
  }
}

async function getSetNumberOfDrafts(
  findOptions = {},
  skipNumber = 0,
  limit = 10,
  sortBy = {
    created: "desc",
  }
) {

  try{
    return Draft.find(findOptions)
    .populate({ path: "gameId", select: "displayName image linkName -_id" })
    .populate({ path: "author", select: "displayName profileImg -_id" })
    .sort(sortBy)
    .skip(skipNumber)
    .limit(limit)
    .exec();
  } catch(err) {
    throw err;
  }

}

module.exports = {
  model: Draft,
  createDraft: createDraft,
  updateDraft: updateDraft,
  getSetNumberOfDrafts: getSetNumberOfDrafts,
};

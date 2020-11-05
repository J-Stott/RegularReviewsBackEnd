const _ = require("lodash");
const Draft = require("../models/draft");
const User = require("../models/user");
const Game = require("../models/game");
const HttpError = require("../helpers/http-error");

const getUserDrafts = async (req, res, next) => {
  try {
    let drafts = await Draft.getSetNumberOfDrafts({ author: req.user.id });

    if (_.isEmpty(drafts)) {
      drafts = [];
    }

    return res.status(200).json(drafts);
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not get user data", 422, next);
  }
};

const createDraft = async (req, res, next) => {
  try {
    let user = await User.findUser({ _id: req.user.id });

    const igdbId = Number(req.body.igdbId);
    let game = await Game.findOrCreateGameEntry(igdbId);
    await Draft.createDraft(user, game, req);

    return res.status(200).json({ message: "Draft saved" });
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not create draft", 422, next);
  }
};

const getDraftData = async (req, res, next) => {
  try {
    const draftId = req.params.draftId;

    let draft = await Draft.model
      .findOne({ _id: draftId, author: req.user.id })
      .populate({
        path: "gameId",
        model: "Game",
        select: { displayName: 1, igdbId: 1, _id: 0 },
      })
      .exec();

    if (!draft) {
      return HttpError.sendHttpError("Could not find draft", 404, next);
    }

    console.log(draft);

    const data = {
      review: draft.toObject(),
    };

    return res.status(200).json(data);
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not create draft", 422, next);
  }
};

const updateDraft = async (req, res, next) => {
  try {
    const draftId = req.params.draftId;

    const igdbId = Number(req.body.igdbId);
    let game = await Game.findOrCreateGameEntry(igdbId);

    await Draft.updateDraft(draftId, game, req);

    return res.status(200).json({message: "draft updated"});
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not create draft", 422, next);
  }
};

const deleteDraft = async (req, res, next) => {
  try {
    console.log("Delete route hit");
    const draftId = req.params.draftId;

    let deleteResult = await Draft.model
      .deleteOne({ _id: draftId, author: req.user.id })
      .exec();

    if (deleteResult.ok && deleteResult.deletedCount === 1) {
      return res
        .status(200)
        .json({ message: "Draft deleted", draftId: draftId });
    }

    return res.status(404).json({ message: "Could not delete draft" });
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not delete draft", 422, next);
  }
};

module.exports = {
  getUserDrafts: getUserDrafts,
  createDraft: createDraft,
  getDraftData: getDraftData,
  updateDraft: updateDraft,
  deleteDraft: deleteDraft,
};

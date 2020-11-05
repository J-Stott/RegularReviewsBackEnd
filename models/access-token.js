const mongoose = require("mongoose");
const axios = require("axios");

const EventEmitter = require("events");
const Locker = require("../helpers/update-locker");

const bus = new EventEmitter();

//Stores access tokens granted through twitch oauth
const accessTokenSchema = new mongoose.Schema({
  token: { type: String },
  expirationTime: {
    type: Date,
    required: true,
    index: { expires: 10 },
  },
});

const accessToken = mongoose.model("AccessToken", accessTokenSchema);

async function getValidAccessToken() {
  try {
    const key = `AccessTokenCheck`;

    if (Locker.exists(key)) {
      await new Promise((resolve) => bus.once("unlocked", resolve));
    }

    Locker.add(key);

    const tokens = await accessToken.find({}).exec();

    let token = null;
    if (tokens.length > 0) {
      token = tokens[0];
    }

    //if we have no stored token, or we do but it has expired, generate a new access token
    if (!token || (token && token.expirationTime < Date.now())) {
      if (token) {
        token.remove();
      }
      const url =
        "https://id.twitch.tv/oauth2/token?client_id=" +
        process.env.IGDB_CLIENT_ID +
        "&client_secret=" +
        process.env.IGDB_CLIENT_SECRET +
        "&grant_type=client_credentials";

      console.log(url);

      const response = await axios({
        url: url,
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });

      const responseData = response.data;

      const newToken = new accessToken({
        token: responseData.access_token,
        expirationTime: new Date(Date.now() + responseData.expires_in * 1000),
      });

      token = await newToken.save();
    }

    Locker.remove(key);
    bus.emit("unlocked");
    return token;
  } catch (err) {
    throw err;
  }
}

module.exports = {
  model: accessToken,
  getValidAccessToken: getValidAccessToken,
};

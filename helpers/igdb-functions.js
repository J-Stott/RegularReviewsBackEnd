const axios = require("axios");
const stringSimilarity = require("string-similarity");
const settings = require("../settings");

const AccessToken = require("../models/access-token");

function getGameImageUrl(gameData) {
  let imageUrl = settings.DEFAULT_GAME_IMAGE;

  if ("cover" in gameData) {
    imageUrl = gameData.cover.url;
    imageUrl = `https:${imageUrl.replace("t_thumb", "t_cover_big")}`;
  }

  return imageUrl;
}

async function searchForGames(
  searchTerm,
  limit = settings.IGDB_LIMIT,
  offset = 0
) {
  const token = await AccessToken.getValidAccessToken();

  return axios({
    url: "https://api.igdb.com/v4/games",
    method: "POST",
    headers: {
      Accept: "application/json",
      "Client-ID": process.env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${token.token}`,
    },
    data: `fields id,name,summary,url,cover.url,first_release_date; search "${searchTerm}"; limit ${limit}; offset ${offset}; `,
  });
}

//collates DB and api games and sorts them based on closeness to search term
async function collateDbAndIgdbGames(Game, searchTerm) {
  // other way of searching text
  // const games = await Game.model.find({$text: {$search: searchTerm}})
  // .select("igdbId displayName image")
  // .exec();

  try {
    const games = await Game.model
      .find({ displayName: { $regex: searchTerm, $options: "i" } })
      .select("igdbId displayName image linkName")
      .exec();

    let responseData = null;

    if (games.length < settings.IGDB_LIMIT) {
      const numGames = games.length + settings.IGDB_LIMIT;
      response = await searchForGames(searchTerm, numGames);
      console.log(response);

      if (response.status !== 200) {
        return {
          status: response.status,
          statusText: response.statusText,
        };
      }

      responseData = response.data;
    }

    const ids = games.map((data) => {
      return data.igdbId;
    });

    const gameData = [...games];

    responseData.forEach((data) => {
      if (!ids.includes(data.id)) {
        gameData.push({
          igdbId: data.id,
          displayName: data.name,
          image: getGameImageUrl(data),
          linkName: Game.getAfterLastSlash(data.url),
        });
      }
    });

    if (gameData.length === 0) {
      return {};
    }

    const gameNames = gameData.map((data) => {
      return data.displayName.toLowerCase();
    });

    const results = stringSimilarity.findBestMatch(searchTerm, gameNames)
      .ratings;

    results.sort(function (a, b) {
      if (a.rating > b.rating) {
        return -1;
      }

      if (a.rating < b.rating) {
        return 1;
      }

      return 0;
    });

    const resultGameData = [];
    const searchThreshold = 0.2;

    /* add to list if it meets a certain threshold
        looking at returned searches, things below a 0.2 seem to be 
        irrelevant */
    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      if (result.rating > searchThreshold) {
        for (let j = 0; j < gameData.length; j++) {
          let data = gameData[j];
          if (result.target === data.displayName.toLowerCase()) {
            resultGameData.push(data);
            gameData.splice(j, 1);
            break;
          }
        }
      }
    }

    return resultGameData;
  } catch (err) {
    throw err;
  }
}

//find a game by a specific ID.
async function findGameByIgdbId(id) {
  try {
    const token = await AccessToken.getValidAccessToken();

    let gameData = await axios({
      url: "https://api.igdb.com/v4/games",
      method: "POST",
      headers: {
        Accept: "application/json",
        "Client-ID": process.env.IGDB_CLIENT_ID,
        Authorization: `Bearer ${token.token}`,
      },
      data: `fields id,name,summary,url,cover.url,first_release_date; where id = ${id};`,
    });

    if (gameData.data.length === 0) {
      return [];
    }

    return gameData.data[0];
  } catch (err) {
    throw err;
  }
}

module.exports = {
  findGameByIgdbId: findGameByIgdbId,
  collateDbAndIgdbGames: collateDbAndIgdbGames,
};

require("dotenv").config();
const fs = require("fs");
const path = require("path");

const http = require("http");
const https = require("https");

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const HttpError = require("./helpers/http-error");

const homeRoutes = require("./routes/home");
const profileRoutes = require("./routes/profile");
const gamesRoutes = require("./routes/games");
const usersRoutes = require("./routes/users");
const draftsRoutes = require("./routes/drafts");
const reviewsRoutes = require("./routes/reviews");

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use(helmet());

app.use("/uploads/avatars", express.static(path.join("uploads", "avatars")));
app.use(
  "/uploads/game-covers",
  express.static(path.join("uploads", "game-covers"))
);

//required to ensure CORS is ignored
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");
  next();
});

//routes go here
app.use("/api/", homeRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/drafts", draftsRoutes);
app.use("/api/reviews", reviewsRoutes);

//default error handling
app.use((req, res, next) => {
  const error = new HttpError.HttpError("Unknown error occured", 404);
  console.log(error);
  next(error);
});

//error handling
app.use((err, req, res, next) => {
  //removes any file sent with an invalid request
  if (req.file) {
    fs.unlink(req.file.path, (err) => {
      console.log(err);
    });
  }

  if (res.headerSent) {
    return next(err);
  }

  console.log(err);

  res.status(err.code || 500).json({
    message: err.message || "Unknown error occurred!",
  });
});

//db connecting
mongoose
  .connect(process.env.DB_CONNECTION, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  })
  .then(() => {
    //const server = http.createServer(app).listen(80);

    const secureServer = https
      .createServer(
        {
          key: fs.readFileSync("server.key"),
          cert: fs.readFileSync("server.cert"),
        },
        app
      )
      .listen(443, () => {
        console.log("Server listening!");
      });
  })
  .catch((err) => {
    console.log(err);
  });

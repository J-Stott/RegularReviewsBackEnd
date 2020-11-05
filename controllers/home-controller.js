const _ = require("lodash");
const passport = require("passport");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { validationResult } = require("express-validator");
const HttpError = require("../helpers/http-error");
const oauthClient = require("../helpers/google-oauth");
const User = require("../models/user");
const Review = require("../models/review");
const Reset = require("../models/reset");
const TokenBlacklist = require("../models/token-blacklist");
const { RateLimiterMongo } = require("rate-limiter-flexible");
const settings = require("../settings");

const home = async (req, res, next) => {
  try {
    const index = Number(req.params.index);
    const reviews = await Review.getSetNumberOfReviews(
      {},
      index * settings.NUM_REVIEWS_TO_GET
    );
    return res.status(200).json({ reviews });
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError("Could not get any reviews", 422, next);
  }
};

const registerUser = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return HttpError.sendHttpError(
      "Invalid inputs passed. Please check data.",
      422,
      next
    );
  }

  const username = _.toLower(req.body.username);
  const displayName = req.body.username;
  const email = _.toLower(req.body.email);
  const password = req.body.password;

  //add user to database and authenticate them if successful
  User.model.register(
    { username: username, displayName: displayName, email: email },
    password,
    function (err, user) {
      if (err) {
        console.log(err);
        const error = new HttpError.HttpError(
          "This username or email address is already in use. Please try again.",
          422
        );
        return next(error);
      } else {
        passport.authenticate("local")(req, res, function () {
          user.roles = ["user"];
          user.save().then(() => {
            return res.status(201).json({
              message: "New user created. Please log in to continue",
            });
          });
        });
      }
    }
  );
};


//limiter functions to stop brute forcing of accounts
const maxWrongAttemptsByIPperDay = 100;
const maxConsecutiveFailsByUsernameAndIP = 10;

const limiterSlowBruteByIP = new RateLimiterMongo({
  storeClient: mongoose.connection,
  keyPrefix: "login_fail_ip_per_day",
  points: maxWrongAttemptsByIPperDay,
  duration: 60 * 60 * 24,
  blockDuration: 60 * 60 * 24, // Block for 1 day, if 100 wrong attempts per day
});

const limiterConsecutiveFailsByUsernameAndIP = new RateLimiterMongo({
  storeClient: mongoose.connection,
  keyPrefix: "login_fail_consecutive_username_and_ip",
  points: maxConsecutiveFailsByUsernameAndIP,
  duration: 60 * 60 * 24 * 90, // Store number for 90 days since first fail
  blockDuration: 60 * 60, // Block for 1 hour
});

const getUsernameIPkey = (username, ip) => `${username}_${ip}`;

//authenticates user, creates JWT and cookie
const loginUser = async (req, res, next) => {
  try {
    const remember = req.body.remember;

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return HttpError.sendHttpError(
        "Invalid inputs passed. Please check data.",
        422,
        next
      );
    }

    const ipAddress = req.ip;
    const usernameIPkey = getUsernameIPkey(req.body.username, ipAddress);
    console.log(usernameIPkey);

    const [resUsernameAndIP, resSlowByIP] = await Promise.all([
      limiterConsecutiveFailsByUsernameAndIP.get(usernameIPkey),
      limiterSlowBruteByIP.get(ipAddress),
    ]);

    let retrySecs = 0;

    console.log(resSlowByIP);
    console.log(resUsernameAndIP);

    // Check if IP or Username + IP is already blocked
    if (
      resSlowByIP !== null &&
      resSlowByIP.consumedPoints > maxWrongAttemptsByIPperDay
    ) {
      retrySecs = Math.round(resSlowByIP.msBeforeNext / 1000) || 1;
    } else if (
      resUsernameAndIP !== null &&
      resUsernameAndIP.consumedPoints > maxConsecutiveFailsByUsernameAndIP
    ) {
      retrySecs = Math.round(resUsernameAndIP.msBeforeNext / 1000) || 1;
    }

    if (retrySecs > 0) {
      res.set("Retry-After", String(retrySecs));
      return HttpError.sendHttpError("Too many requests", 429, next);
    }

    passport.authenticate("local", { session: false }, async (err, user) => {
      try {
        if (err) {
          console.log(err);
          return HttpError.sendHttpError(
            "Could not log in. Please try again.",
            500,
            next
          );
        }

        if (!user) {
          const promises = [limiterSlowBruteByIP.consume(ipAddress)];
          if (user !== null) {
            // Count failed attempts by Username + IP only for registered users
            promises.push(
              limiterConsecutiveFailsByUsernameAndIP.consume(usernameIPkey)
            );
          }

          await Promise.all(promises);

          return HttpError.sendHttpError(
            "Could not find user with these credentials. Please try again.",
            500,
            next
          );
        } else {
          req.login(user, { session: false }, async (loginErr) => {
            try {
              if (loginErr) {
                return next(loginErr);
              } else {
                if (
                  resUsernameAndIP !== null &&
                  resUsernameAndIP.consumedPoints > 0
                ) {
                  // Reset on successful authorisation
                  await limiterConsecutiveFailsByUsernameAndIP.delete(
                    usernameIPkey
                  );
                }

                await limiterSlowBruteByIP.delete(
                  ipAddress
                );

                let expirationTime = parseInt(
                  process.env.JWT_EXPIRATION_DEFAULT
                );

                //set jwt expiration time
                if (remember) {
                  expirationTime = parseInt(
                    process.env.JWT_EXPIRATION_REMEMBER
                  );
                }

                const payload = {
                  id: user.id,
                  username: user.username,
                  expires: Date.now() + expirationTime,
                };

                const signOptions = {
                  expiresIn: expirationTime,
                };

                const token = jwt.sign(
                  payload,
                  process.env.JWT_SECRET,
                  signOptions
                );

                res.cookie("jwt", token, {
                  httpOnly: true,
                  secure: true,
                  sameSite: "strict",
                  maxAge: expirationTime,
                });

                const userData = {
                  id: user.id,
                  displayName: user.displayName,
                  avatar: user.avatar,
                  roles: user.roles,
                };

                res.status(200).send({
                  userData: userData,
                  expirationTime: Date.now() + expirationTime,
                });
              }
            } catch (err) {
              console.log(err);
            }
          });
        }
      } catch (err) {
        console.log(err);
        return HttpError.sendHttpError(
          "Could not find user with these credentials. Please try again.",
          500,
          next
        );
      }
    })(req, res, next);
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError(
      "Could not find user with these credentials. Please try again.",
      500,
      next
    );
  }
};

const logoutUser = async (req, res, next) => {
  const tokenExpiryTime = req.user.expires - Date.now();
  const token = req.cookies.jwt;

  const blackListedToken = new TokenBlacklist.model({
    token: token,
    expirationTime: new Date(Date.now() + tokenExpiryTime),
  });

  await blackListedToken.save();

  console.log("attempting to destroy cookie");
  res.clearCookie("jwt");
  res.status(200).json({ message: "User successfully logged out" });
};

//creates email and forwards it to the appropriate address with a code to reset their password
const forgotPassword = async (req, res, next) => {
  try {
    const userCredentials = _.toLower(req.body.username);

    const user = await User.model
      .findOne({
        $or: [{ username: userCredentials }, { email: userCredentials }],
      })
      .exec();

    if (!user) {
      return HttpError.sendHttpError(
        "The user or email could not be found.",
        422,
        next
      );
    }

    const buf = crypto.randomBytes(30);

    const token = `${user.username}-${buf.toString("hex")}`;
    const reset = new Reset.model({
      token: token,
      user: user._id,
    });

    await reset.save();

    const accessToken = await oauthClient.getAccessToken();

    const smtpTransport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.GOOGLE_EMAIL,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken: accessToken,
      },
    });

    const mailOptions = {
      from: process.env.GOOGLE_EMAIL,
      to: user.email,
      subject: "Regular Reviews Password Reset",
      text: `You are receiving this email because you (or someone else) has requested a password reset on the account linked to this email address.

      Please click on the following link, or paste this into your browser to complete the process:

      https://localhost:3000/reset/${token}

      If you did not request this, please ignore this email and your password will remain unchanged.
      `,
    };

    smtpTransport.sendMail(mailOptions, function (err) {
      if (!err) {
        return res.status(200).json({
          message: "A reset link has been sent to your email address.",
        });
      } else {
        return HttpError.sendHttpError(
          "The password reset email could not be sent",
          422,
          next
        );
      }
    });
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError(
      "The password reset email could not be sent",
      422,
      next
    );
  }
};

//checks if the reset token sent is valid
const checkResetToken = async (req, res, next) => {
  try {
    const token = req.params.token;

    const reset = await Reset.model.findOne({ token: token }).exec();

    if (!reset) {
      return HttpError.sendHttpError(
        "The reset link is either invalid or has expired",
        422,
        next
      );
    }

    res.status(200).json({});
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError(
      "Your password could not be reset",
      422,
      next
    );
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const token = req.params.token;
    const newPassword = req.body.password;

    const reset = await Reset.model.findOne({ token: token }).exec();

    if (!reset) {
      return HttpError.sendHttpError(
        "The reset link is either invalid or has expired",
        422,
        next
      );
    }

    const user = await User.model.findOne({ _id: reset.user }).exec();

    if (!user) {
      await Reset.model.deleteOne({ token: token }).exec();
      return HttpError.sendHttpError(
        "This user does not have a token. You shouldn't be here",
        422,
        next
      );
    } else {
      user.setPassword(newPassword, async function (err, newPasswordUser) {
        if (!err) {
          await newPasswordUser.save();
          await Reset.model.deleteOne({ token: token }).exec();
          res.status(200).json({
            message:
              "Pasword reset successfully! You will be redirected to the login page shortly.",
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
    return HttpError.sendHttpError(
      "Your password could not be reset",
      422,
      next
    );
  }
};

module.exports = {
  home: home,
  registerUser: registerUser,
  loginUser: loginUser,
  logoutUser: logoutUser,
  forgotPassword: forgotPassword,
  checkResetToken: checkResetToken,
  resetPassword: resetPassword,
};

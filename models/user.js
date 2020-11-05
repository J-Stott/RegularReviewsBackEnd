const mongoose = require("mongoose");
const passport = require("passport");
const EventEmitter = require("events");
const passportLocalMongoose = require("passport-local-mongoose");
const passportJWTStrategy = require("passport-jwt").Strategy;

const Locker = require("../helpers/update-locker");

const bus = new EventEmitter();

//setup user schema
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true, dropDups: true },
  displayName: { type: String },
  email: { type: String, unique: true, required: true, dropDups: true },
  avatar: { type: String, default: "/uploads/avatars/default.png" },
  bio: { type: String, default: "A Regular Reviewer" },
  numReviews: { type: Number, default: 0 },
  roles: [
    { type: String, enum: ["user", "admin", "super_admin"], default: ["user"] },
  ],
});

//allow user to also use email to login
userSchema.plugin(passportLocalMongoose, {
  usernameQueryFields: ["email"],
  usernameLowerCase: true,
});

const User = mongoose.model("User", userSchema);

//passport setup - serialise functions are more general
passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user.id);
});
passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

//gets the token from our cookie
const cookieExtractor = (req) => {
  let token = null;

  if (req && req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  } else if (req && req.signedCookies && req.signedCookies.jwt) {
    token = req.signedCookies.jwt;
  }

  return token;
};

//jwt middleware. gets cookie from extractor function and forwards on user if successful
passport.use(
  new passportJWTStrategy(
    {
      jwtFromRequest: cookieExtractor,
      secretOrKey: process.env.JWT_SECRET,
    },
    (jwtPayload, done) => {
      if (Date.now() > jwtPayload.expires) {
        return done(new Error("JWT Expired"));
      }

      return done(null, jwtPayload);
    }
  )
);

//provide object to find user
//can either search for id, username or email address
async function findUser(userData) {
  try {
    let foundUser = null;

    foundUser = await User.findOne(userData).exec();
  
    return foundUser;
  } catch(err) {
    console.log("--find user error--");
    throw err;
  }

}

async function updateReviewCount(userId, increase, session = null) {
  try {
    const key = `ReviewCountUpdate_${userId}`;

    if(Locker.exists(key)){
        await new Promise(resolve => bus.once("unlocked", resolve));
    }
  
    Locker.add(key);
    let user = await User.findOne({ _id: userId }).exec();
  
    if (increase) {
      user.numReviews++;
    } else {
      user.numReviews--;
    }
  
    Locker.remove(key);
    bus.emit("unlocked");
    if(session){
      await user.save({session: session});
    } else {
      await user.save();
    }
  } catch(err) {
    console.log("--update review count error--");
    throw err;
  }


}

function isSuperAdmin(user) {
  return user.roles.includes("super_admin");
}

function isAdmin(user) {
  return user.roles.includes("super_admin") || user.roles.includes("admin");
}

module.exports = {
  model: User,
  findUser: findUser,
  updateReviewCount: updateReviewCount,
  isSuperAdmin: isSuperAdmin,
  isAdmin: isAdmin,
};

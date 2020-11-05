const jwt = require("jsonwebtoken");
const passport = require("passport");
const HttpError = require("./http-error");

//attempts to verify the JWT in the cookie, and return the user's id.
function verifyToken(req){
    if(req.cookies.jwt){
        const decodedToken = jwt.verify(req.cookies.jwt, process.env.JWT_SECRET);
        return decodedToken.id;
    }   

    return null;
}

//middleware that will attempt to authorize the user via a JWT
function authorizeUser(req, res, next) {
    passport.authenticate("jwt", { session: false }, (err, user, info) => {
        if(err) {
            return next(err);
        }

        if(!user) {
            return HttpError.sendHttpError("User could not be authenticated", 403, next);
        }

        req.user = user;
        return next();
    })(req, res, next)
}

module.exports = {
    verifyToken: verifyToken,
    authorizeUser: authorizeUser
}
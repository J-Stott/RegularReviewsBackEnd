const multer = require('multer');
const settings = require("../settings");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, settings.PROJECT_DIR + '/uploads/avatars');
    },
    filename: function (req, file, cb) {
        
        const user = req.user;
        console.log(user);

        var token = crypto.randomBytes(16).toString('hex');

        const filename = `${user.username}_avatar_${token}${path.extname(file.originalname)}`;

        cb(null, filename);
    }
});

//filter by png, and jpegs only
const upload = multer({
    storage: storage,
    fileFilter: function(req, file, cb){
        var ext = path.extname(file.originalname);
        ext = ext.toLowerCase();

        if(ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg'){
            return cb(null, false);
        }

        cb(null, true);
    }
});

function deleteProfileImage(foundUser) {
    if (foundUser.avatar !== settings.DEFAULT_PROFILE_IMG) {
        const fileName = path.join(settings.PROJECT_DIR, foundUser.avatar);

        fs.unlink(fileName, (err) => {
            if (err) {
                console.error(err);
            }
        });
    }
}


module.exports = {
    upload: upload,
    deleteProfileImage: deleteProfileImage,
};
const mongoose = require("mongoose");

//setup reset schema. Document should automatically expire after an hour
const resetSchema = new mongoose.Schema({
    token: {type: String},
    user: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
    created: {type: Date, default: Date.now, expires: 3600}
});

const Reset = mongoose.model("Reset", resetSchema);

module.exports = {
    model: Reset,
};
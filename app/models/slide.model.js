const mongoose = require("mongoose");

const Slide = mongoose.model(
    "Slide",
    new mongoose.Schema({
        title: String,
        order: Number,
        image: String,
    }, {
        timestamps: true
    })
);

module.exports = Slide;
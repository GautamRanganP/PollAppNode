const mongoose = require("mongoose");

const pollSchema = new mongoose.Schema({
  title: { type: String, default: null },
  description: { type: String, default: null },
  startdate: { type: String},
  enddate: { type: String },
  votes:{type: Number},
  optionone:{type: String},
  optiontwo:{type: String},
  optiononevote:{type: Number},
  optiontwovote:{type: Number},
});

module.exports = mongoose.model("poll", pollSchema);
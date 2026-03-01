// models/Quiz.js
const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options:  [{ type: String, required: true }], // 4 ta variant
  correct:  { type: Number, required: true },   // 0,1,2,3 index
});

const QuizSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  subject:   { type: String, default: '' },
  class:     { type: String, default: '' },
  teacher:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questions: [QuestionSchema],
  maxCoins:  { type: Number, default: 20 },
  timeLimit: { type: Number, default: 10 }, // minut
  active:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Quiz', QuizSchema);

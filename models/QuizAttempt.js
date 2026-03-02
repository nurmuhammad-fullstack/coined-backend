// models/QuizAttempt.js
const mongoose = require('mongoose');

const QuizAttemptSchema = new mongoose.Schema({
  quiz:        { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers:     [Number],   // oddiy index array: [0, 2, 1, 3, ...]
  score:       { type: Number, default: 0 },
  coinsEarned: { type: Number, default: 0 },
  timeTaken:   { type: Number, default: 0 },
}, { timestamps: true });

QuizAttemptSchema.index({ quiz: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('QuizAttempt', QuizAttemptSchema);
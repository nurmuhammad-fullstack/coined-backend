// models/QuizAttempt.js
const mongoose = require('mongoose');

const QuizAttemptSchema = new mongoose.Schema({
  quiz:       { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers:    [{ questionIndex: Number, selected: Number }],
  score:      { type: Number, default: 0 },  // foiz 0-100
  coinsEarned:{ type: Number, default: 0 },
  timeTaken:  { type: Number, default: 0 },  // sekund
}, { timestamps: true });

// Bir o'quvchi bir testni bir marta yechsin
QuizAttemptSchema.index({ quiz: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('QuizAttempt', QuizAttemptSchema);

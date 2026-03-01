// routes/quizzes.js
const express       = require('express');
const Quiz          = require('../models/Quiz');
const QuizAttempt   = require('../models/QuizAttempt');
const User          = require('../models/User');
const Transaction   = require('../models/Transaction');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

// Lazy-load bot to avoid circular dependency
const getNotify = () => {
  try { return require('../bot').notifyStudent; }
  catch { return null; }
};

// POST /api/quizzes/:id/submit — javoblarni yuborish (student)
router.post('/:id/submit', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can submit' });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz || !quiz.active) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Allaqachon yechganmi?
    const existing = await QuizAttempt.findOne({
      quiz: quiz._id,
      student: req.user._id,
    });

    if (existing) {
      return res.status(400).json({
        message: 'Already completed',
        attempt: existing,
      });
    }

    const { answers, timeTaken } = req.body;

    // 🔐 Himoya: format tekshirish
    if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
      return res.status(400).json({ message: 'Invalid answers format' });
    }

    // ✅ Ball hisoblash (frontend oddiy index array yuboradi)
    let correct = 0;

    answers.forEach((selected, index) => {
      const q = quiz.questions[index];

      if (q && Number(q.correct) === Number(selected)) {
        correct++;
      }
    });

    const score       = Math.round((correct / quiz.questions.length) * 100);
    const coinsEarned = Math.round(quiz.maxCoins * score / 100);

    // Attempt saqlash
    const attempt = await QuizAttempt.create({
      quiz: quiz._id,
      student: req.user._id,
      answers,
      score,
      coinsEarned,
      timeTaken: timeTaken || 0,
    });

    // 💰 Coin berish
    if (coinsEarned > 0) {
      const student = await User.findById(req.user._id);

      student.coins += coinsEarned;
      await student.save();

      await Transaction.create({
        student: student._id,
        label: `Test: ${quiz.title} (${score}%)`,
        type: 'earn',
        amount: coinsEarned,
        category: 'quiz',
      });

      // Telegram notify
      if (student.telegramId) {
        const notify = getNotify();
        if (notify) {
          notify(
            student.telegramId,
            `🎯 *Test natijasi!*\n\n` +
            `📝 ${quiz.title}\n` +
            `✅ Natija: *${score}%* (${correct}/${quiz.questions.length})\n` +
            `🪙 *+${coinsEarned} coin* qo'shildi!\n` +
            `💰 Balans: *${student.coins} coin*`
          );
        }
      }
    }

    return res.json({
      score,
      coinsEarned,
      correct,
      total: quiz.questions.length,
      attempt,
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;

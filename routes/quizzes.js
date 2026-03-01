// routes/quizzes.js
const express     = require('express');
const Quiz        = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const User        = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

const getNotify = () => {
  try { return require('../bot').notifyStudent; }
  catch { return null; }
};

// ⚠️ /my-attempts /:id dan OLDIN bo'lishi SHART
// ── GET /api/quizzes/my-attempts ─────────────────
router.get('/my-attempts', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students' });
    }
    const attempts = await QuizAttempt.find({ student: req.user._id })
      .populate('quiz', 'title subject maxCoins')
      .sort({ createdAt: -1 });
    return res.json(attempts);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/quizzes ─────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    let quizzes;
    if (req.user.role === 'teacher') {
      quizzes = await Quiz.find({ teacher: req.user._id }).sort({ createdAt: -1 });
    } else {
      quizzes = await Quiz.find({ active: true }).sort({ createdAt: -1 });
      
      // Har bir quiz uchun student's attempt bor-yo'qligini tekshirish
      const studentId = req.user._id;
      const attempts = await QuizAttempt.find({ student: studentId });
      const attemptMap = {};
      attempts.forEach(a => {
        attemptMap[a.quiz.toString()] = a;
      });
      
      // Har bir quizga attempt ma'lumotini qo'shish
      quizzes = quizzes.map(q => {
        const qObj = q.toObject ? q.toObject() : q;
        const attempt = attemptMap[q._id.toString()];
        if (attempt) {
          qObj.attempt = {
            _id: attempt._id,
            score: attempt.score,
            coinsEarned: attempt.coinsEarned,
            createdAt: attempt.createdAt
          };
        }
        return qObj;
      });
    }
    return res.json(quizzes);
  } catch (err) {
    console.error('Error in GET /quizzes:', err);
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/quizzes ────────────────────────────
router.post('/', protect, teacherOnly, async (req, res) => {
  try {
    const { title, subject, class: className, maxCoins, timeLimit, questions } = req.body;
    if (!title || !questions?.length) {
      return res.status(400).json({ message: 'Title and questions required' });
    }
    const quiz = await Quiz.create({
      title, subject,
      class: className,
      maxCoins: maxCoins || 20,
      timeLimit: timeLimit || 10,
      questions,
      teacher: req.user._id,
      active: true,
    });
    return res.status(201).json(quiz);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/quizzes/:id ─────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    return res.json(quiz);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/quizzes/:id ─────────────────────────
router.put('/:id', protect, teacherOnly, async (req, res) => {
  try {
    const quiz = await Quiz.findOneAndUpdate(
      { _id: req.params.id, teacher: req.user._id },
      req.body,
      { new: true }
    );
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    return res.json(quiz);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/quizzes/:id ──────────────────────
router.delete('/:id', protect, teacherOnly, async (req, res) => {
  try {
    await Quiz.findOneAndDelete({ _id: req.params.id, teacher: req.user._id });
    await QuizAttempt.deleteMany({ quiz: req.params.id });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/quizzes/:id/toggle ───────────────
router.patch('/:id/toggle', protect, teacherOnly, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, teacher: req.user._id });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    quiz.active = !quiz.active;
    await quiz.save();
    return res.json(quiz);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/quizzes/:id/attempts ───────────────
router.get('/:id/attempts', protect, teacherOnly, async (req, res) => {
  try {
    // First check if the quiz belongs to this teacher
    const quiz = await Quiz.findOne({ _id: req.params.id, teacher: req.user._id });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    // Get teacher's student IDs
    const teacherStudents = await User.find({ role: 'student', teacher: req.user._id }).select('_id');
    const studentIds = teacherStudents.map(s => s._id);

    // Get attempts only from teacher's students
    const attempts = await QuizAttempt.find({ quiz: req.params.id, student: { $in: studentIds } })
      .populate('student', 'name email class avatar color coins')
      .sort({ score: -1 });
    return res.json(attempts);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/quizzes/:id/submit ─────────────────
router.post('/:id/submit', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can submit' });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz || !quiz.active) {
      return res.status(404).json({ message: 'Quiz not found or not active' });
    }

    const existing = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id });
    if (existing) {
      return res.status(400).json({ message: 'Already completed', attempt: existing });
    }

    const { answers, timeTaken } = req.body;

    if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
      return res.status(400).json({ message: 'Invalid answers format' });
    }

    let correct = 0;
    const formattedAnswers = answers.map((selected, index) => {
      const q = quiz.questions[index];
      if (q && Number(q.correct) === Number(selected)) correct++;
      return { questionIndex: index, selected: Number(selected) };
    });

    const score       = Math.round((correct / quiz.questions.length) * 100);
    const coinsEarned = Math.round(quiz.maxCoins * score / 100);

    const attempt = await QuizAttempt.create({
      quiz: quiz._id,
      student: req.user._id,
      answers: formattedAnswers, score, coinsEarned,
      timeTaken: timeTaken || 0,
    });

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

      if (student.telegramId) {
        const notify = getNotify();
        if (notify) {
          notify(student.telegramId,
            `🎯 *Test natijasi!*\n\n📝 ${quiz.title}\n` +
            `✅ Natija: *${score}%* (${correct}/${quiz.questions.length})\n` +
            `🪙 *+${coinsEarned} coin* qo'shildi!\n💰 Balans: *${student.coins} coin*`
          );
        }
      }
    }

    return res.json({ score, coinsEarned, correct, total: quiz.questions.length, attempt });

  } catch (err) {
    console.error('Error in POST /quizzes/:id/submit:', err);
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
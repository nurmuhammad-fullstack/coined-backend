// routes/quizzes.js
const express      = require('express');
const Quiz         = require('../models/Quiz');
const QuizAttempt  = require('../models/QuizAttempt');
const User         = require('../models/User');
const Transaction  = require('../models/Transaction');
const Notification = require('../models/Notification');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/quizzes — teacher: o'z testlari, student: active testlar
router.get('/', protect, async (req, res) => {
  try {
    let quizzes;
    if (req.user.role === 'teacher') {
      quizzes = await Quiz.find({ teacher: req.user._id }).sort({ createdAt: -1 });
    } else {
      // Student uchun: active + o'z sinfi
      // Use manual projection to properly hide correct answers
      const allQuizzes = await Quiz.find({ active: true }).sort({ createdAt: -1 });
      // Map to remove correct answers from questions
      quizzes = allQuizzes.map(q => {
        const obj = q.toObject();
        obj.questions = obj.questions.map(question => ({
          question: question.question,
          options: question.options
          // correct answer is NOT included
        }));
        return obj;
      });
      // Har bir quiz uchun yechganmi yo'qmi
      const attempts = await QuizAttempt.find({ student: req.user._id }).select('quiz score coinsEarned');
      const attemptMap = {};
      attempts.forEach(a => { attemptMap[a.quiz.toString()] = a; });
      quizzes = quizzes.map(q => ({
        ...q,
        attempt: attemptMap[q._id.toString()] || null,
      }));
    }
    res.json(quizzes);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/quizzes/my-attempts — student's own attempts (must be before /:id)
router.get('/my-attempts', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student')
      return res.status(403).json({ message: 'Only students can view their attempts' });
    
    const attempts = await QuizAttempt.find({ student: req.user._id })
      .populate('quiz', 'title subject maxCoins')
      .sort({ createdAt: -1 });
    res.json(attempts);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/quizzes — test yaratish (teacher)
router.post('/', protect, teacherOnly, async (req, res) => {
  try {
    const { title, subject, class: cls, questions, maxCoins, timeLimit } = req.body;
    if (!title || !questions?.length)
      return res.status(400).json({ message: 'Title and questions required' });

    const quiz = await Quiz.create({
      title, subject, class: cls,
      questions, maxCoins: maxCoins || 20,
      timeLimit: timeLimit || 10,
      teacher: req.user._id,
    });

    res.status(201).json(quiz);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/quizzes/:id — bitta test
router.get('/:id', protect, async (req, res) => {
  try {
    let quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    // Student uchun correct javoblarni yashir
    if (req.user.role === 'student') {
      const obj = quiz.toObject();
      // To'g'ri javoblarni ko'rsatish (test uchun)
      // obj.questions = obj.questions.map(q => ({ ...q, correct: undefined }));
      // Yechganmi?
      const attempt = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id });
      obj.attempt = attempt || null;
      return res.json(obj);
    }

    res.json(quiz);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/quizzes/:id/results — natijalar (teacher)
router.get('/:id/results', protect, teacherOnly, async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({ quiz: req.params.id })
      .populate('student', 'name email class avatar color coins')
      .sort({ score: -1 });
    res.json(attempts);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/quizzes/:id/submit — javoblarni yuborish (student)
router.post('/:id/submit', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student')
      return res.status(403).json({ message: 'Only students can submit' });

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz || !quiz.active)
      return res.status(404).json({ message: 'Quiz not found' });

    // Allaqachon yechganmi?
    const existing = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id });
    if (existing)
      return res.status(400).json({ message: 'Already completed', attempt: existing });

    const { answers, timeTaken } = req.body;

    // Frontend sends [0, 2, 1, 3] format (array of selected indices)
    // Convert to questionIndex format for scoring
    let formattedAnswers = answers;
    if (answers.length > 0 && typeof answers[0] === 'number') {
      // Convert [0, 2, 1, 3] to [{ questionIndex: 0, selected: 0 }, ...]
      formattedAnswers = answers.map((selected, questionIndex) => ({ questionIndex, selected }));
    }

    // Ball hisoblash
    let correct = 0;
    formattedAnswers.forEach(a => {
      const q = quiz.questions[a.questionIndex];
      if (q && q.correct === a.selected) correct++;
    });

    const score      = Math.round((correct / quiz.questions.length) * 100);
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

    // Coin berish
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

      // Create notification for quiz completion
      await Notification.create({
        user: student._id,
        type: 'quiz',
        title: 'Test Completed! 🎉',
        message: `You scored ${score}% on "${quiz.title}" and earned ${coinsEarned} coins!`,
        icon: '🎯',
      });
    }

    res.json({ attempt, score, coinsEarned, correct, total: quiz.questions.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/quizzes/:id — o'chirish (teacher)
router.delete('/:id', protect, teacherOnly, async (req, res) => {
  try {
    await Quiz.findByIdAndDelete(req.params.id);
    await QuizAttempt.deleteMany({ quiz: req.params.id });
    res.json({ message: 'Quiz deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PATCH /api/quizzes/:id/toggle — active/inactive
router.patch('/:id/toggle', protect, teacherOnly, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    quiz.active = !quiz.active;
    await quiz.save();
    res.json(quiz);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;


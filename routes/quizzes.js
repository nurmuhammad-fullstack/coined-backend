const express = require('express');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

const serializeQuizForStudent = (quizDoc, attempt = null) => {
  const quiz = quizDoc.toObject ? quizDoc.toObject() : { ...quizDoc };
  quiz.questions = quiz.questions.map(({ question, options }) => ({ question, options }));
  quiz.attempt = attempt;
  return quiz;
};

const findOwnedQuiz = async (teacherId, quizId) =>
  Quiz.findOne({ _id: quizId, teacher: teacherId });

router.get('/', protect, async (req, res) => {
  try {
    let quizzes;

    if (req.user.role === 'teacher') {
      quizzes = await Quiz.find({ teacher: req.user._id }).sort({ createdAt: -1 });
    } else {
      const classFilter = req.user.class
        ? [{ class: req.user.class }, { class: '' }, { class: null }]
        : [{ class: '' }, { class: null }];
      const allQuizzes = await Quiz.find({
        active: true,
        $or: classFilter,
      }).sort({ createdAt: -1 });

      const attempts = await QuizAttempt.find({ student: req.user._id }).select('quiz score coinsEarned');
      const attemptMap = {};
      attempts.forEach((attempt) => {
        attemptMap[attempt.quiz.toString()] = attempt;
      });

      quizzes = allQuizzes.map((quiz) =>
        serializeQuizForStudent(quiz, attemptMap[quiz._id.toString()] || null)
      );
    }

    res.json(quizzes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/my-attempts', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can view their attempts' });
    }

    const attempts = await QuizAttempt.find({ student: req.user._id })
      .populate('quiz', 'title subject maxCoins')
      .sort({ createdAt: -1 });
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, teacherOnly, async (req, res) => {
  try {
    const { title, subject, class: cls, questions, maxCoins, timeLimit } = req.body;
    if (!title || !questions?.length) {
      return res.status(400).json({ message: 'Title and questions required' });
    }

    const quiz = await Quiz.create({
      title,
      subject,
      class: cls,
      questions,
      maxCoins: maxCoins || 20,
      timeLimit: timeLimit || 10,
      teacher: req.user._id,
    });

    res.status(201).json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    if (req.user.role === 'student') {
      const isAssignedClass = !quiz.class || quiz.class === req.user.class;
      if (!quiz.active || !isAssignedClass) {
        return res.status(404).json({ message: 'Quiz not found' });
      }

      const attempt = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id });
      return res.json(serializeQuizForStudent(quiz, attempt || null));
    }

    if (quiz.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/results', protect, teacherOnly, async (req, res) => {
  try {
    const quiz = await findOwnedQuiz(req.user._id, req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    const attempts = await QuizAttempt.find({ quiz: req.params.id })
      .populate('student', 'name email class avatar color coins')
      .sort({ score: -1 });
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/attempts', protect, teacherOnly, async (req, res) => {
  try {
    const quiz = await findOwnedQuiz(req.user._id, req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    const attempts = await QuizAttempt.find({ quiz: req.params.id })
      .populate('student', 'name email class avatar color coins')
      .sort({ createdAt: -1 });
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, teacherOnly, async (req, res) => {
  try {
    const { title, subject, class: cls, questions, maxCoins, timeLimit, active } = req.body;
    const quiz = await findOwnedQuiz(req.user._id, req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    if (!title || !questions?.length) {
      return res.status(400).json({ message: 'Title and questions required' });
    }

    quiz.title = title;
    quiz.subject = subject || '';
    quiz.class = cls || '';
    quiz.questions = questions;
    quiz.maxCoins = maxCoins || 20;
    quiz.timeLimit = timeLimit || 10;
    if (typeof active === 'boolean') {
      quiz.active = active;
    }

    await quiz.save();
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/submit', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can submit' });
    }

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz || !quiz.active) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const isAssignedClass = !quiz.class || quiz.class === req.user.class;
    if (!isAssignedClass) {
      return res.status(403).json({ message: 'Quiz not assigned to your class' });
    }

    const existing = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id });
    if (existing) {
      return res.status(400).json({ message: 'Already completed', attempt: existing });
    }

    const { answers = [], timeTaken } = req.body;

    let correct = 0;
    for (let i = 0; i < answers.length && i < quiz.questions.length; i++) {
      if (Number(answers[i]) === Number(quiz.questions[i].correct)) {
        correct++;
      }
    }

    const score = Math.round((correct / quiz.questions.length) * 100);
    const coinsEarned = Math.round(quiz.maxCoins * score / 100);

    const attempt = await QuizAttempt.create({
      quiz: quiz._id,
      student: req.user._id,
      answers,
      score,
      coinsEarned,
      timeTaken: timeTaken || 0,
    });

    if (coinsEarned > 0) {
      const student = await User.findById(req.user._id);
      student.coins += coinsEarned;
      await student.save();

      await Transaction.create({
        student: student._id,
        teacher: student.teacher || quiz.teacher,
        label: `Test: ${quiz.title} (${score}%)`,
        type: 'earn',
        amount: coinsEarned,
        category: 'quiz',
      });

      await Notification.create({
        user: student._id,
        type: 'quiz',
        title: 'Test Completed!',
        message: `You scored ${score}% on "${quiz.title}" and earned ${coinsEarned} coins!`,
        icon: 'target',
      });
    }

    res.json({
      attempt,
      score,
      coinsEarned,
      correct,
      total: quiz.questions.length,
      correctAnswers: quiz.questions.map((question) => question.correct),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, teacherOnly, async (req, res) => {
  try {
    const quiz = await findOwnedQuiz(req.user._id, req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    await Quiz.findByIdAndDelete(req.params.id);
    await QuizAttempt.deleteMany({ quiz: req.params.id });
    res.json({ message: 'Quiz deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/toggle', protect, teacherOnly, async (req, res) => {
  try {
    const quiz = await findOwnedQuiz(req.user._id, req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    quiz.active = !quiz.active;
    await quiz.save();
    res.json(quiz);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

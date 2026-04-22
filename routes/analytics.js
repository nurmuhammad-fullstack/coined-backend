const express = require('express');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Transaction = require('../models/Transaction');
const ShopItem = require('../models/ShopItem');
const Class = require('../models/Class');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

const getTeacherStudentIds = async (teacherId) => {
  const students = await User.find({ role: 'student', teacher: teacherId }).select('_id');
  return students.map((student) => student._id);
};

router.get('/overview', protect, teacherOnly, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const studentIds = await getTeacherStudentIds(teacherId);

    const totalStudents = studentIds.length;
    const totalQuizzes = await Quiz.countDocuments({ teacher: teacherId });
    const totalClasses = await Class.countDocuments({ teacher: teacherId });

    const coinsEarned = await Transaction.aggregate([
      { $match: { type: 'earn', teacher: teacherId } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const coinsSpent = await Transaction.aggregate([
      { $match: { type: 'spend', category: 'shop', teacher: teacherId } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } },
    ]);

    const quizAttempts = await QuizAttempt.find({ student: { $in: studentIds } })
      .populate({ path: 'quiz', match: { teacher: teacherId } });

    const validAttempts = quizAttempts.filter((attempt) => attempt.quiz);
    const totalAttempts = validAttempts.length;
    const avgScore = totalAttempts > 0
      ? Math.round(validAttempts.reduce((sum, attempt) => sum + attempt.score, 0) / totalAttempts)
      : 0;

    res.json({
      totalStudents,
      totalQuizzes,
      totalClasses,
      totalCoinsDistributed: coinsEarned[0]?.total || 0,
      totalCoinsSpent: coinsSpent[0]?.total || 0,
      totalAttempts,
      avgScore,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/quizzes', protect, teacherOnly, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const quizzes = await Quiz.find({ teacher: teacherId }).sort({ createdAt: -1 });

    const quizStats = await Promise.all(quizzes.map(async (quiz) => {
      const attempts = await QuizAttempt.find({ quiz: quiz._id });
      const totalAttempts = attempts.length;
      const avgScore = totalAttempts > 0
        ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / totalAttempts)
        : 0;
      const avgTime = totalAttempts > 0
        ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.timeTaken, 0) / totalAttempts)
        : 0;
      const totalCoins = attempts.reduce((sum, attempt) => sum + attempt.coinsEarned, 0);

      return {
        _id: quiz._id,
        title: quiz.title,
        subject: quiz.subject,
        class: quiz.class,
        maxCoins: quiz.maxCoins,
        active: quiz.active,
        totalAttempts,
        avgScore,
        avgTime,
        totalCoinsEarned: totalCoins,
        createdAt: quiz.createdAt,
      };
    }));

    res.json(quizStats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/students', protect, teacherOnly, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const students = await User.find({ role: 'student', teacher: teacherId }).sort({ coins: -1 });

    const studentStats = await Promise.all(students.map(async (student) => {
      const attempts = await QuizAttempt.find({ student: student._id });
      const totalQuizzesTaken = attempts.length;
      const avgScore = totalQuizzesTaken > 0
        ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / totalQuizzesTaken)
        : 0;
      const totalCoinsEarned = attempts.reduce((sum, attempt) => sum + attempt.coinsEarned, 0);

      const transactions = await Transaction.find({ student: student._id, teacher: teacherId });
      const coinsEarnedTx = transactions
        .filter((tx) => tx.type === 'earn')
        .reduce((sum, tx) => sum + tx.amount, 0);
      const coinsSpentTx = transactions
        .filter((tx) => tx.type === 'spend')
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      return {
        _id: student._id,
        name: student.name,
        email: student.email,
        class: student.class,
        avatar: student.avatar,
        color: student.color,
        currentCoins: student.coins,
        totalQuizzesTaken,
        avgScore,
        totalCoinsEarned,
        coinsEarned: coinsEarnedTx,
        coinsSpent: coinsSpentTx,
      };
    }));

    studentStats.sort((a, b) => b.totalCoinsEarned - a.totalCoinsEarned);
    res.json(studentStats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/coins', protect, teacherOnly, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const transactions = await Transaction.find({ teacher: teacherId })
      .populate('student', 'name class')
      .sort({ createdAt: -1 });

    const byCategory = await Transaction.aggregate([
      { $match: { teacher: teacherId } },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: { $abs: '$amount' } },
          count: { $sum: 1 },
        },
      },
    ]);

    const byType = await Transaction.aggregate([
      { $match: { teacher: teacherId } },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: { $abs: '$amount' } },
          count: { $sum: 1 },
        },
      },
    ]);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await Transaction.aggregate([
      { $match: { teacher: teacherId, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          earned: {
            $sum: { $cond: [{ $eq: ['$type', 'earn'] }, '$amount', 0] },
          },
          spent: {
            $sum: { $cond: [{ $eq: ['$type', 'spend'] }, { $abs: '$amount' }, 0] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      byCategory,
      byType,
      recentTransactions: transactions.slice(0, 20),
      monthlyStats,
      totalTransactions: transactions.length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/shop', protect, teacherOnly, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const shopItems = await ShopItem.find({ createdBy: teacherId }).sort({ createdAt: -1 });
    const purchases = await Transaction.find({ category: 'shop', teacher: teacherId })
      .populate('student', 'name class')
      .sort({ createdAt: -1 });

    const itemStats = {};
    purchases.forEach((purchase) => {
      if (!itemStats[purchase.label]) {
        itemStats[purchase.label] = {
          name: purchase.label,
          totalPurchases: 0,
          totalCoinsSpent: 0,
        };
      }
      itemStats[purchase.label].totalPurchases += 1;
      itemStats[purchase.label].totalCoinsSpent += Math.abs(purchase.amount);
    });

    const topItems = Object.values(itemStats)
      .sort((a, b) => b.totalPurchases - a.totalPurchases)
      .slice(0, 10);

    const totalRevenue = purchases.reduce((sum, purchase) => sum + Math.abs(purchase.amount), 0);
    const totalPurchases = purchases.length;

    res.json({
      shopItems,
      purchases: purchases.slice(0, 50),
      recentPurchases: purchases.slice(0, 10),
      topItems,
      totalRevenue,
      totalPurchases,
      activeItems: shopItems.filter((item) => item.active).length,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/classes', protect, teacherOnly, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const classes = await Class.find({ teacher: teacherId });

    const classStats = await Promise.all(classes.map(async (cls) => {
      const students = await User.find({ role: 'student', class: cls.name, teacher: teacherId });
      const quizzes = await Quiz.find({ teacher: teacherId, class: cls.name });

      let totalAttempts = 0;
      let totalScore = 0;

      for (const quiz of quizzes) {
        const attempts = await QuizAttempt.find({ quiz: quiz._id });
        totalAttempts += attempts.length;
        totalScore += attempts.reduce((sum, attempt) => sum + attempt.score, 0);
      }

      const avgScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;
      const totalCoins = students.reduce((sum, student) => sum + student.coins, 0);

      return {
        _id: cls._id,
        name: cls.name,
        description: cls.description,
        studentCount: students.length,
        quizCount: quizzes.length,
        totalAttempts,
        avgScore,
        totalCoins,
        createdAt: cls.createdAt,
      };
    }));

    res.json(classStats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

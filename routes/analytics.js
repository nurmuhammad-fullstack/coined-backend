// routes/analytics.js
const express = require('express');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Transaction = require('../models/Transaction');
const ShopItem = require('../models/ShopItem');
const Class = require('../models/Class');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/overview — dashboard overview
router.get('/overview', protect, teacherOnly, async (req, res) => {
  try {
    const teacherId = req.user._id;
    
    // Get counts
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalQuizzes = await Quiz.countDocuments({ teacher: teacherId });
    const totalClasses = await Class.countDocuments({ teacher: teacherId });
    
    // Total coins distributed (earned by students)
    const coinsEarned = await Transaction.aggregate([
      { $match: { type: 'earn', teacher: teacherId } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Total coins spent in shop
    const coinsSpent = await Transaction.aggregate([
      { $match: { type: 'spend', category: 'shop' } },
      { $group: { _id: null, total: { $sum: { $abs: '$amount' } } } }
    ]);
    
    // Quiz statistics
    const quizAttempts = await QuizAttempt.find()
      .populate({ path: 'quiz', match: { teacher: teacherId } });
    
    const validAttempts = quizAttempts.filter(a => a.quiz);
    const totalAttempts = validAttempts.length;
    const avgScore = totalAttempts > 0 
      ? Math.round(validAttempts.reduce((a, b) => a + b.score, 0) / totalAttempts) 
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
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analytics/quizzes — quiz performance analytics
router.get('/quizzes', protect, teacherOnly, async (req, res) => {
  try {
    const teacherId = req.user._id;
    
    const quizzes = await Quiz.find({ teacher: teacherId }).sort({ createdAt: -1 });
    
    const quizStats = await Promise.all(quizzes.map(async (quiz) => {
      const attempts = await QuizAttempt.find({ quiz: quiz._id });
      const totalAttempts = attempts.length;
      const avgScore = totalAttempts > 0 
        ? Math.round(attempts.reduce((a, b) => a + b.score, 0) / totalAttempts) 
        : 0;
      const avgTime = totalAttempts > 0 
        ? Math.round(attempts.reduce((a, b) => a + b.timeTaken, 0) / totalAttempts) 
        : 0;
      const totalCoins = attempts.reduce((a, b) => a + b.coinsEarned, 0);
      
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
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analytics/students — student performance analytics
router.get('/students', protect, teacherOnly, async (req, res) => {
  try {
    const teacherId = req.user._id;
    
    const students = await User.find({ role: 'student' }).sort({ coins: -1 });
    
    const studentStats = await Promise.all(students.map(async (student) => {
      // Get quiz attempts
      const attempts = await QuizAttempt.find({ student: student._id });
      const totalQuizzesTaken = attempts.length;
      const avgScore = totalQuizzesTaken > 0 
        ? Math.round(attempts.reduce((a, b) => a + b.score, 0) / totalQuizzesTaken) 
        : 0;
      const totalCoinsEarned = attempts.reduce((a, b) => a + b.coinsEarned, 0);
      
      // Get transactions
      const transactions = await Transaction.find({ student: student._id });
      const coinsEarnedTx = transactions
        .filter(t => t.type === 'earn')
        .reduce((a, b) => a + b.amount, 0);
      const coinsSpentTx = transactions
        .filter(t => t.type === 'spend')
        .reduce((a, b) => a + Math.abs(b.amount), 0);
      
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
    
    // Sort by total coins earned
    studentStats.sort((a, b) => b.totalCoinsEarned - a.totalCoinsEarned);
    
    res.json(studentStats);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analytics/coins — coin flow analytics
router.get('/coins', protect, teacherOnly, async (req, res) => {
  try {
    const teacherId = req.user._id;
    
    // Get all transactions
    const transactions = await Transaction.find()
      .populate('student', 'name class')
      .sort({ createdAt: -1 });
    
    // Group by category
    const byCategory = await Transaction.aggregate([
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: { $abs: '$amount' } },
          count: { $sum: 1 },
        }
      }
    ]);
    
    // Group by type (earn vs spend)
    const byType = await Transaction.aggregate([
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: { $abs: '$amount' } },
          count: { $sum: 1 },
        }
      }
    ]);
    
    // Recent transactions
    const recentTransactions = transactions.slice(0, 20);
    
    // Monthly stats (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyStats = await Transaction.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          earned: {
            $sum: { $cond: [{ $eq: ['$type', 'earn'] }, '$amount', 0] }
          },
          spent: {
            $sum: { $cond: [{ $eq: ['$type', 'spend'] }, { $abs: '$amount' }, 0] }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    
    res.json({
      byCategory,
      byType,
      recentTransactions,
      monthlyStats,
      totalTransactions: transactions.length,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analytics/shop — shop analytics
router.get('/shop', protect, teacherOnly, async (req, res) => {
  try {
    // Get all shop items
    const shopItems = await ShopItem.find().sort({ createdAt: -1 });
    
    // Get all purchase transactions
    const purchases = await Transaction.find({ category: 'shop' })
      .populate('student', 'name class')
      .sort({ createdAt: -1 });
    
    // Group by item (estimate based on label)
    const itemStats = {};
    purchases.forEach(p => {
      if (!itemStats[p.label]) {
        itemStats[p.label] = {
          name: p.label,
          totalPurchases: 0,
          totalCoinsSpent: 0,
        };
      }
      itemStats[p.label].totalPurchases += 1;
      itemStats[p.label].totalCoinsSpent += Math.abs(p.amount);
    });
    
    // Top items
    const topItems = Object.values(itemStats)
      .sort((a, b) => b.totalPurchases - a.totalPurchases)
      .slice(0, 10);
    
    // Recent purchases
    const recentPurchases = purchases.slice(0, 10);
    
    // Total stats
    const totalRevenue = purchases.reduce((a, b) => a + Math.abs(b.amount), 0);
    const totalPurchases = purchases.length;
    
    res.json({
      shopItems,
      purchases: purchases.slice(0, 50),
      recentPurchases,
      topItems,
      totalRevenue,
      totalPurchases,
      activeItems: shopItems.filter(i => i.active).length,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analytics/classes — class-wise analytics
router.get('/classes', protect, teacherOnly, async (req, res) => {
  try {
    const teacherId = req.user._id;
    
    const classes = await Class.find({ teacher: teacherId });
    
    const classStats = await Promise.all(classes.map(async (cls) => {
      const students = await User.find({ role: 'student', class: cls.name });
      const quizzes = await Quiz.find({ teacher: teacherId, class: cls.name });
      
      let totalAttempts = 0;
      let totalScore = 0;
      
      for (const quiz of quizzes) {
        const attempts = await QuizAttempt.find({ quiz: quiz._id });
        totalAttempts += attempts.length;
        totalScore += attempts.reduce((a, b) => a + b.score, 0);
      }
      
      const avgScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;
      const totalCoins = students.reduce((a, b) => a + b.coins, 0);
      
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
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;


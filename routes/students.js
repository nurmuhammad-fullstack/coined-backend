// routes/students.js
const express     = require('express');
const User        = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/students/leaderboard — public (for leaderboard page)
router.get('/leaderboard', protect, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('name email class avatar color coins')
      .sort({ coins: -1 })
      .limit(50);
    res.json(students);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/students
router.get('/', protect, teacherOnly, async (req, res) => {
  try {
    // Only return students that belong to this teacher
    const students = await User.find({ role: 'student', teacher: req.user._id }).select('-password').sort({ coins: -1 });
    res.json(students);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/students/all - Get all students for teacher (including legacy)
router.get('/all', protect, teacherOnly, async (req, res) => {
  try {
    // Get students that belong to this teacher OR have no teacher assigned (legacy students)
    const students = await User.find({ 
      role: 'student',
      $or: [
        { teacher: req.user._id },
        { teacher: null },
        { teacher: { $exists: false } }
      ]
    }).select('-password').sort({ name: 1 });
    res.json(students);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/students/:id
router.get('/:id', protect, teacherOnly, async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select('-password');
    if (!student || student.role !== 'student')
      return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/students/:id
router.delete('/:id', protect, teacherOnly, async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student')
      return res.status(404).json({ message: 'Student not found' });
    await User.findByIdAndDelete(req.params.id);
    await Transaction.deleteMany({ student: req.params.id });
    res.json({ message: 'Student deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/students/:id/coins  ← asosiy
router.post('/:id/coins', protect, teacherOnly, async (req, res) => {
  try {
    const { amount, type, label, category } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ message: 'Amount must be positive' });

    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student')
      return res.status(404).json({ message: 'Student not found' });

    if (type === 'spend') {
      if (student.coins < amount)
        return res.status(400).json({ message: 'Not enough coins' });
      student.coins -= amount;
    } else {
      student.coins += amount;
    }
    await student.save();

    const tx = await Transaction.create({
      student:  student._id,
      teacher:  req.user._id,
      label:    label || (type === 'earn' ? 'Teacher Bonus' : 'Teacher Deduction'),
      type,
      amount:   type === 'earn' ? amount : -amount,
      category: category || 'behavior',
    });

    // Create notification for coin change
    const notificationType = type === 'earn' ? 'bonus' : 'system';
    const notificationTitle = type === 'earn' ? 'Coins Added! 💰' : 'Coins Deducted 💸';
    const notificationMessage = type === 'earn' 
      ? `You received ${amount} coins! ${label ? `(${label})` : ''}`
      : `${amount} coins were deducted. ${label ? `(${label})` : ''}`;

    await Notification.create({
      user: student._id,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      icon: type === 'earn' ? '💰' : '💸',
    });

    res.json({ student, transaction: tx });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/students/:id/transactions
router.get('/:id/transactions', protect, async (req, res) => {
  try {
    const isOwn     = req.user._id.toString() === req.params.id;
    const isTeacher = req.user.role === 'teacher';
    if (!isOwn && !isTeacher)
      return res.status(403).json({ message: 'Access denied' });
    const txs = await Transaction.find({ student: req.params.id })
      .sort({ createdAt: -1 }).limit(100);
    res.json(txs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;


const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

const loadOwnedStudent = async (teacherId, studentId) => {
  const student = await User.findById(studentId);
  if (!student || student.role !== 'student') return null;
  if (student.teacher?.toString() !== teacherId.toString()) return false;
  return student;
};

router.get('/leaderboard', protect, async (req, res) => {
  try {
    const filter = { role: 'student' };
    if (req.user.role === 'student' && req.user.teacher) {
      filter.teacher = req.user.teacher;
    }

    const students = await User.find(filter)
      .select('name email class avatar color coins')
      .sort({ coins: -1 })
      .limit(50);
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', protect, teacherOnly, async (req, res) => {
  try {
    const students = await User.find({ role: 'student', teacher: req.user._id })
      .select('-password')
      .sort({ coins: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/all', protect, teacherOnly, async (req, res) => {
  try {
    const students = await User.find({
      role: 'student',
      $or: [
        { teacher: req.user._id },
        { teacher: null },
        { teacher: { $exists: false } },
      ],
    })
      .select('-password')
      .sort({ name: 1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, teacherOnly, async (req, res) => {
  try {
    const student = await loadOwnedStudent(req.user._id, req.params.id);
    if (student === null) return res.status(404).json({ message: 'Student not found' });
    if (student === false) return res.status(403).json({ message: 'Access denied' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, teacherOnly, async (req, res) => {
  try {
    const student = await loadOwnedStudent(req.user._id, req.params.id);
    if (student === null) return res.status(404).json({ message: 'Student not found' });
    if (student === false) return res.status(403).json({ message: 'Access denied' });

    await User.findByIdAndDelete(req.params.id);
    await Transaction.deleteMany({ student: req.params.id });
    res.json({ message: 'Student deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/coins', protect, teacherOnly, async (req, res) => {
  try {
    const { amount, type, label, category } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be positive' });
    }

    const student = await loadOwnedStudent(req.user._id, req.params.id);
    if (student === null) return res.status(404).json({ message: 'Student not found' });
    if (student === false) return res.status(403).json({ message: 'Access denied' });

    if (type === 'spend') {
      if (student.coins < amount) {
        return res.status(400).json({ message: 'Not enough coins' });
      }
      student.coins -= amount;
    } else {
      student.coins += amount;
    }
    await student.save();

    const tx = await Transaction.create({
      student: student._id,
      teacher: req.user._id,
      label: label || (type === 'earn' ? 'Teacher Bonus' : 'Teacher Deduction'),
      type,
      amount: type === 'earn' ? amount : -amount,
      category: category || 'behavior',
    });

    await Notification.create({
      user: student._id,
      type: type === 'earn' ? 'bonus' : 'system',
      title: type === 'earn' ? 'Coins Added!' : 'Coins Deducted',
      message: type === 'earn'
        ? `You received ${amount} coins! ${label ? `(${label})` : ''}`
        : `${amount} coins were deducted. ${label ? `(${label})` : ''}`,
      icon: type === 'earn' ? 'coins' : 'minus',
    });

    res.json({ student, transaction: tx });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/class', protect, teacherOnly, async (req, res) => {
  try {
    const { class: newClass } = req.body;
    if (!newClass || !newClass.trim())
      return res.status(400).json({ message: 'Class name is required' });

    const student = await loadOwnedStudent(req.user._id, req.params.id);
    if (student === null) return res.status(404).json({ message: 'Student not found' });
    if (student === false) return res.status(403).json({ message: 'Access denied' });

    student.class = newClass.trim();
    await student.save();
    res.json({ student });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/transactions', protect, async (req, res) => {
  try {
    const isOwn = req.user._id.toString() === req.params.id;
    const isTeacher = req.user.role === 'teacher';

    if (!isOwn && !isTeacher) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (isTeacher) {
      const student = await loadOwnedStudent(req.user._id, req.params.id);
      if (student === null) return res.status(404).json({ message: 'Student not found' });
      if (student === false) return res.status(403).json({ message: 'Access denied' });
    }

    const txs = await Transaction.find({ student: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(txs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

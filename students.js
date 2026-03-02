// routes/students.js
const express     = require('express');
const User        = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

// Lazy-load bot to avoid circular dependency
const getNotify = () => {
  try { return require('../bot').notifyStudent; }
  catch { return null; }
};

// ── GET /api/students ────────────────────────────
router.get('/', protect, teacherOnly, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password').sort({ coins: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/students/:id ────────────────────────
router.get('/:id', protect, teacherOnly, async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select('-password');
    if (!student || student.role !== 'student')
      return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/students/:id ─────────────────────
router.delete('/:id', protect, teacherOnly, async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student')
      return res.status(404).json({ message: 'Student not found' });

    await User.findByIdAndDelete(req.params.id);
    await Transaction.deleteMany({ student: req.params.id });

    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/students/:id/coins ─────────────────
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

    // ── Telegram notification ──────────────────
    if (student.telegramId) {
      const notify = getNotify();
      if (notify) {
        const teacherName = req.user.name || 'O\'qituvchi';
        const txLabel     = label || (type === 'earn' ? 'Bonus' : 'Chegirma');

        if (type === 'earn') {
          notify(student.telegramId,
            `🪙 *+${amount} coin!*\n\n` +
            `📝 Sabab: *${txLabel}*\n` +
            `👨‍🏫 O'qituvchi: ${teacherName}\n` +
            `💰 Yangi balans: *${student.coins} coin*`
          );
        } else {
          notify(student.telegramId,
            `📉 *-${amount} coin*\n\n` +
            `📝 Sabab: *${txLabel}*\n` +
            `👨‍🏫 O'qituvchi: ${teacherName}\n` +
            `💰 Yangi balans: *${student.coins} coin*`
          );
        }
      }
    }

    res.json({ student, transaction: tx });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/students/:id/transactions ───────────
router.get('/:id/transactions', protect, async (req, res) => {
  try {
    const isOwn     = req.user._id.toString() === req.params.id;
    const isTeacher = req.user.role === 'teacher';
    if (!isOwn && !isTeacher)
      return res.status(403).json({ message: 'Access denied' });

    const txs = await Transaction.find({ student: req.params.id })
      .sort({ createdAt: -1 }).limit(100);
    res.json(txs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

// routes/shop.js
const express   = require('express');
const ShopItem  = require('../models/ShopItem');
const Transaction = require('../models/Transaction');
const User      = require('../models/User');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/shop
router.get('/', protect, async (req, res) => {
  try {
    const items = await ShopItem.find({ active: true }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/shop — image field ham qabul qiladi
router.post('/', protect, teacherOnly, async (req, res) => {
  try {
    const { name, cost, category, emoji, image, desc, tag } = req.body;
    if (!name || !cost) return res.status(400).json({ message: 'Name and cost required' });

    const item = await ShopItem.create({
      name, cost, category,
      emoji: emoji || '🎁',
      image: image || null,
      desc:  desc  || '',
      tag:   tag   || null,
      createdBy: req.user._id,
    });
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/shop/:id
router.delete('/:id', protect, teacherOnly, async (req, res) => {
  try {
    const item = await ShopItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/shop/:id/buy
router.post('/:id/buy', protect, async (req, res) => {
  try {
    if (req.user.role !== 'student')
      return res.status(403).json({ message: 'Only students can buy' });

    const item = await ShopItem.findById(req.params.id);
    if (!item || !item.active) return res.status(404).json({ message: 'Item not found' });

    const student = await User.findById(req.user._id);
    if (student.coins < item.cost)
      return res.status(400).json({ message: 'Not enough coins' });

    student.coins -= item.cost;
    await student.save();

    await Transaction.create({
      student: student._id,
      label: item.name,
      type: 'spend',
      amount: -item.cost,
      category: 'shop',
    });

    res.json({ student });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;

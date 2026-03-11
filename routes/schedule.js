const express = require('express');
const Class = require('../models/Class');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/schedule/:classId - Get schedule for a class
router.get('/:classId', protect, async (req, res) => {
  try {
    const cls = await Class.findOne({ 
      _id: req.params.classId, 
      teacher: req.user._id 
    });
    
    if (!cls) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    res.json(cls.schedule || { enabled: false, days: [], time: '09:00' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/schedule/:classId - Update schedule for a class
router.put('/:classId', protect, teacherOnly, async (req, res) => {
  try {
    const { enabled, days, time, notifyBefore8Hours, notifyBefore10Minutes } = req.body;
    
    const cls = await Class.findOne({ 
      _id: req.params.classId, 
      teacher: req.user._id 
    });
    
    if (!cls) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    cls.schedule = {
      enabled: enabled || false,
      days: days || [],
      time: time || '09:00',
      notifyBefore8Hours: notifyBefore8Hours !== false,
      notifyBefore10Minutes: notifyBefore10Minutes !== false
    };
    
    await cls.save();
    
    res.json(cls.schedule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/schedule - Get all schedules for teacher
router.get('/', protect, teacherOnly, async (req, res) => {
  try {
    const classes = await Class.find({ teacher: req.user._id, 'schedule.enabled': true })
      .select('name schedule');
    
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;


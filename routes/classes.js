// routes/classes.js
const express = require('express');
const Class = require('../models/Class');
const User = require('../models/User');
const { protect, teacherOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/classes - Get all classes for teacher
router.get('/', protect, teacherOnly, async (req, res) => {
  try {
    const classes = await Class.find({ teacher: req.user._id }).sort({ createdAt: -1 });
    
    // Get student count for each class
    const classesWithCount = await Promise.all(
      classes.map(async (cls) => {
        const studentCount = await User.countDocuments({ 
          role: 'student', 
          class: cls.name,
          teacher: req.user._id 
        });
        return {
          _id: cls._id,
          name: cls.name,
          description: cls.description,
          studentCount,
          createdAt: cls.createdAt,
          updatedAt: cls.updatedAt
        };
      })
    );
    
    res.json(classesWithCount);
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
});

// GET /api/classes - Get all classes (for students - returns classes they belong to)
router.get('/student', protect, async (req, res) => {
  try {
    // For students, return the class they belong to
    if (req.user.role === 'student') {
      if (!req.user.class) {
        return res.json([]);
      }
      const cls = await Class.findOne({ name: req.user.class, teacher: req.user.teacher });
      if (cls) {
        return res.json([{
          _id: cls._id,
          name: cls.name,
          description: cls.description,
          studentCount: 1,
          createdAt: cls.createdAt,
          updatedAt: cls.updatedAt
        }]);
      }
      return res.json([]);
    }
    // Teachers get all their classes
    const classes = await Class.find({ teacher: req.user._id }).sort({ createdAt: -1 });
    res.json(classes);
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
});

// POST /api/classes - Create new class
router.post('/', protect, teacherOnly, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Class name is required' });
    }
    
    // Check if class already exists for this teacher
    const existingClass = await Class.findOne({ 
      name: name.trim(), 
      teacher: req.user._id 
    });
    
    if (existingClass) {
      return res.status(400).json({ message: 'Class with this name already exists' });
    }
    
    const newClass = await Class.create({
      name: name.trim(),
      description: description || '',
      teacher: req.user._id
    });
    
    res.status(201).json({
      _id: newClass._id,
      name: newClass.name,
      description: newClass.description,
      studentCount: 0,
      createdAt: newClass.createdAt,
      updatedAt: newClass.updatedAt
    });
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
});

// PUT /api/classes/:id - Update class
router.put('/:id', protect, teacherOnly, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const cls = await Class.findOne({ _id: req.params.id, teacher: req.user._id });
    
    if (!cls) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Check if new name already exists (if name changed)
    if (name && name.trim() !== cls.name) {
      const existingClass = await Class.findOne({ 
        name: name.trim(), 
        teacher: req.user._id,
        _id: { $ne: cls._id }
      });
      
      if (existingClass) {
        return res.status(400).json({ message: 'Class with this name already exists' });
      }
      
      // Update all students in old class to new class name
      await User.updateMany(
        { role: 'student', class: cls.name, teacher: req.user._id },
        { class: name.trim() }
      );
      
      cls.name = name.trim();
    }
    
    if (description !== undefined) {
      cls.description = description;
    }
    
    await cls.save();
    
    // Get updated student count
    const studentCount = await User.countDocuments({ 
      role: 'student', 
      class: cls.name,
      teacher: req.user._id 
    });
    
    res.json({
      _id: cls._id,
      name: cls.name,
      description: cls.description,
      studentCount,
      createdAt: cls.createdAt,
      updatedAt: cls.updatedAt
    });
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
});

// DELETE /api/classes/:id - Delete class
router.delete('/:id', protect, teacherOnly, async (req, res) => {
  try {
    const cls = await Class.findOne({ _id: req.params.id, teacher: req.user._id });
    
    if (!cls) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Don't delete students, just remove their class association
    await User.updateMany(
      { role: 'student', class: cls.name, teacher: req.user._id },
      { class: '' }
    );
    
    await Class.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Class deleted' });
  } catch (err) { 
    res.status(500).json({ message: err.message }); 
  }
});

module.exports = router;


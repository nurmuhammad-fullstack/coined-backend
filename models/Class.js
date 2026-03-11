// models/Class.js
const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    default: '', 
    trim: true 
  },
  teacher: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  // Schedule for class days and time
  schedule: {
    enabled: { type: Boolean, default: false },
    days: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }],
    time: { type: String, default: '09:00' }, // HH:MM format
    notifyBefore8Hours: { type: Boolean, default: true },
    notifyBefore10Minutes: { type: Boolean, default: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('Class', ClassSchema);


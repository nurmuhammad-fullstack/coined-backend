const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  receiver: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  content: { 
    type: String, 
    required: true,
    trim: true 
  },
  read: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

// Index for faster queries
MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

module.exports = mongoose.model('Chat', MessageSchema);


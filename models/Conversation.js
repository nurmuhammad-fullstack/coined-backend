const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  // For direct messages - store the other participant
  partner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Unread counts per user
  unreadCounts: {
    type: Map,
    of: Number,
    default: {}
  },
  // Group chat metadata
  name: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Index for efficient queries
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });
ConversationSchema.index({ type: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);


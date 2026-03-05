const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    trim: true,
    default: ''
  },
  // Message types: text, image, file, system
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  // Attachment URL (for image/file messages)
  attachment: {
    url: String,
    filename: String,
    mimetype: String,
    size: Number
  },
  // Delivery status
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
    default: 'sending'
  },
  // Read receipts - who has read this message
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Reactions to message
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: {
      type: String,
      default: '👍'
    }
  }],
  // Reply to another message
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  // Is this message deleted (soft delete)
  deleted: {
    type: Boolean,
    default: false
  },
  // Is this a typing indicator (not stored in DB, used for socket events)
  // This is kept for reference but not persisted
}, { timestamps: true });

// Index for efficient queries
MessageSchema.index({ conversation: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ 'readBy.user': 1 });

module.exports = mongoose.model('Message', MessageSchema);


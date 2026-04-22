const express = require('express');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendToUser, isUserOnline } = require('../services/socket');

const router = express.Router();

// Helper to get io instance from app
const getIO = (req) => req.app.get('io');
const canUsersChat = (currentUser, partner) => {
  if (!partner) return false;

  if (currentUser.role === 'student') {
    return partner.role === 'teacher' && currentUser.teacher?.toString() === partner._id.toString();
  }

  if (currentUser.role === 'teacher') {
    return partner.role === 'student' && partner.teacher?.toString() === currentUser._id.toString();
  }

  return false;
};

// ==================== CONVERSATIONS ====================

// GET /api/chat/conversations - Get all conversations for current user
router.get('/conversations', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // Try new Conversation model first
    let conversations = await Conversation.find({
      participants: userId
    })
    .populate('participants', 'name avatar color role class')
    .populate('lastMessage')
    .sort({ lastMessageAt: -1 });

    // If no conversations in new model, check old Chat model
    if (conversations.length === 0) {
      const Chat = require('../models/Chat');
      
      // Get unique conversation partners from old messages
      const sentMessages = await Chat.aggregate([
        { $match: { sender: userId } },
        { $group: { _id: '$receiver' } }
      ]);
      
      const receivedMessages = await Chat.aggregate([
        { $match: { receiver: userId } },
        { $group: { _id: '$sender' } }
      ]);
      
      // Combine and get unique user IDs
      const partnerIds = [...new Set([
        ...sentMessages.map(m => m._id.toString()),
        ...receivedMessages.map(m => m._id.toString())
      ])];
      
      // Get user details for each partner
      conversations = await Promise.all(
        partnerIds.map(async (partnerId) => {
          const partner = await User.findById(partnerId).select('name avatar color role class');
          
          // Get last message
          const lastMessage = await Chat.findOne({
            $or: [
              { sender: userId, receiver: partnerId },
              { sender: partnerId, receiver: userId }
            ]
          }).sort({ createdAt: -1 });
          
          // Get unread count
          const unreadCount = await Chat.countDocuments({
            sender: partnerId,
            receiver: userId,
            read: false
          });
          
          return {
            _id: partnerId, // Use partnerId as conversation ID for old chats
            type: 'direct',
            participants: partner ? [partner] : [],
            lastMessage: lastMessage ? {
              content: lastMessage.content,
              type: 'text',
              createdAt: lastMessage.createdAt,
              isFromMe: lastMessage.sender.toString() === userId.toString(),
              status: lastMessage.read ? 'read' : 'delivered'
            } : null,
            unreadCount,
            lastMessageAt: lastMessage?.createdAt || new Date(),
            isOnline: false
          };
        })
      );
      
      // Sort by last message time
      conversations.sort((a, b) => {
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
      });
    } else {
      // Format new conversations for response
      conversations = await Promise.all(
        conversations.map(async (conv) => {
          const otherParticipants = conv.participants.filter(
            p => p._id.toString() !== userId.toString()
          );

          // Get unread count for current user
          const unreadCount = conv.unreadCounts?.get?.(userId.toString()) || 0;

          // Get last message details if exists
          let lastMessage = null;
          if (conv.lastMessage) {
            const msg = await Message.findById(conv.lastMessage).populate('sender', 'name avatar');
            if (msg) {
              lastMessage = {
                content: msg.content,
                type: msg.type,
                createdAt: msg.createdAt,
                isFromMe: msg.sender._id.toString() === userId.toString(),
                status: msg.status
              };
            }
          }

          return {
            _id: conv._id,
            type: conv.type,
            participants: otherParticipants,
            lastMessage,
            unreadCount,
            lastMessageAt: conv.lastMessageAt,
            isOnline: conv.type === 'direct' && otherParticipants[0] 
              ? isUserOnline(otherParticipants[0]._id)
              : false
          };
        })
      );
    }

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/chat/conversations - Create or get direct conversation
router.post('/conversations', protect, async (req, res) => {
  try {
    const { partnerId } = req.body;
    const userId = req.user._id;

    if (!partnerId) {
      return res.status(400).json({ message: 'Partner ID is required' });
    }

    // Verify partner exists
    const partner = await User.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!canUsersChat(req.user, partner)) {
      return res.status(403).json({ message: 'You can only message linked teacher/student accounts' });
    }

    // Check if conversation already exists (direct message)
    let conversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [userId, partnerId] }
    }).populate('participants', 'name avatar color role class');

    if (!conversation) {
      // Create new conversation
      conversation = await Conversation.create({
        type: 'direct',
        participants: [userId, partnerId],
        partner: partnerId,
        unreadCounts: new Map()
      });
      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'name avatar color role class');
    }

    res.status(201).json(conversation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/chat/conversations/:conversationId - Get single conversation
router.get('/conversations/:conversationId', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'name avatar color role class');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Verify user is participant
    if (!conversation.participants.some(p => p._id.toString() === userId.toString())) {
      return res.status(403).json({ message: 'Not authorized to view this conversation' });
    }

    res.json(conversation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==================== MESSAGES ====================

// GET /api/chat/messages/:conversationId - Get messages with pagination
router.get('/messages/:conversationId', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    // Try to find conversation in new model
    let conversation = await Conversation.findById(conversationId);
    
    // If not found, try to get from old Chat model for backward compatibility
    if (!conversation) {
      // Check if there's an old chat with this user
      const Chat = require('../models/Chat');
      const partnerId = conversationId;
      
      // Find messages between user and partner (old way)
      const messages = await Chat.find({
        $or: [
          { sender: userId, receiver: partnerId },
          { sender: partnerId, receiver: userId }
        ]
      })
      .populate('sender', 'name avatar color role')
      .populate('receiver', 'name avatar color role')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

      // Mark messages as read
      await Chat.updateMany(
        { sender: partnerId, receiver: userId, read: false },
        { $set: { read: true } }
      );

      // Return in new format
      return res.json({
        messages: messages.reverse(),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: messages.length,
          pages: 1
        }
      });
    }

    // Verify user is participant
    if (!conversation.participants.some(p => p.toString() === userId.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({
      conversation: conversationId,
      deleted: false
    })
    .populate('sender', 'name avatar color role')
    .populate('replyTo')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Message.countDocuments({
      conversation: conversationId,
      deleted: false
    });

    // Mark messages as read
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      },
      {
        $push: { readBy: { user: userId, readAt: new Date() } }
      }
    );

    // Update unread count
    const unreadCounts = conversation.unreadCounts || new Map();
    unreadCounts.set(userId.toString(), 0);
    await Conversation.findByIdAndUpdate(conversationId, {
      unreadCounts
    });

    res.json({
      messages: messages.reverse(), // Reverse for chronological order
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/chat/messages/:conversationId - Send a message
router.post('/messages/:conversationId', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, type = 'text', attachment, replyTo } = req.body;
    const userId = req.user._id;
    const io = getIO(req);

    if (!content?.trim() && !attachment) {
      return res.status(400).json({ message: 'Message content or attachment is required' });
    }

    // Try new Conversation model first
    let conversation = await Conversation.findById(conversationId);
    
    // If not found, try old Chat model for backward compatibility
    if (!conversation) {
      const Chat = require('../models/Chat');
      const receiverId = conversationId;
      
      // Verify receiver exists
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        return res.status(404).json({ message: 'Receiver not found' });
      }

      if (!canUsersChat(req.user, receiver)) {
        return res.status(403).json({ message: 'You can only message linked teacher/student accounts' });
      }

      // Create message in old model
      const message = await Chat.create({
        sender: userId,
        receiver: receiverId,
        content: content.trim()
      });

      const populatedMessage = await Chat.findById(message._id)
        .populate('sender', 'name avatar color role')
        .populate('receiver', 'name avatar color role');

      // Emit socket event for real-time update (to both sender and receiver)
      if (io) {
        // Send to receiver
        sendToUser(io, receiverId, 'message:new', {
          message: populatedMessage,
          conversationId
        });
        // Also send to sender's room so they see their own message
        io.to(`user:${userId}`).emit('message:new', {
          message: populatedMessage,
          conversationId
        });
      }

      return res.status(201).json(populatedMessage);
    }

    // Verify user is participant
    if (!conversation.participants.some(p => p.toString() === userId.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Create message
    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      content: content?.trim() || '',
      type: attachment ? (attachment.mimetype?.startsWith('image') ? 'image' : 'file') : type,
      attachment,
      replyTo,
      status: 'sent'
    });

    await message.populate('sender', 'name avatar color role');

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastMessageAt: new Date()
    });

    // Update unread counts for other participants
    const unreadCounts = conversation.unreadCounts || new Map();
    conversation.participants.forEach(p => {
      if (p.toString() !== userId.toString()) {
        const currentCount = unreadCounts.get(p.toString()) || 0;
        unreadCounts.set(p.toString(), currentCount + 1);
      }
    });
    await Conversation.findByIdAndUpdate(conversationId, { unreadCounts });

    // Send real-time notification
    if (io) {
      conversation.participants.forEach(participantId => {
        if (participantId.toString() !== userId.toString()) {
          sendToUser(io, participantId, 'message:new', {
            message,
            conversationId
          });
        }
      });
      // Also emit to sender's room for immediate display
      io.to(`user:${userId}`).emit('message:new', {
        message,
        conversationId
      });
    }

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/chat/messages/:messageId/read - Mark message as read
router.put('/messages/:messageId/read', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    const io = getIO(req);

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Add user to readBy if not already
    const alreadyRead = message.readBy.some(r => r.user.toString() === userId.toString());
    if (!alreadyRead) {
      message.readBy.push({ user: userId, readAt: new Date() });
      message.status = 'read';
      await message.save();

      // Notify sender
      if (io) {
        sendToUser(io, message.sender, 'message:read', {
          messageId: message._id,
          conversationId: message.conversation,
          userId
        });
      }
    }

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/chat/conversations/:conversationId/read - Mark all messages in conversation as read
router.put('/conversations/:conversationId/read', protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const io = getIO(req);

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Mark all unread messages as read
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      },
      {
        $push: { readBy: { user: userId, readAt: new Date() } },
        $set: { status: 'read' }
      }
    );

    // Reset unread count
    const unreadCounts = conversation.unreadCounts || new Map();
    unreadCounts.set(userId.toString(), 0);
    await Conversation.findByIdAndUpdate(conversationId, { unreadCounts });

    // Notify other participants
    if (io) {
      conversation.participants.forEach(participantId => {
        if (participantId.toString() !== userId.toString()) {
          sendToUser(io, participantId, 'conversation:read', {
            conversationId,
            userId
          });
        }
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/chat/messages/:messageId/reaction - Add reaction to message
router.post('/messages/:messageId/reaction', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user already reacted
    const existingReaction = message.reactions.find(
      r => r.user.toString() === userId.toString()
    );

    if (existingReaction) {
      // Update existing reaction
      existingReaction.emoji = emoji;
    } else {
      // Add new reaction
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();
    await message.populate('reactions.user', 'name avatar');

    res.json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/chat/messages/:messageId - Delete message (soft delete)
router.delete('/messages/:messageId', protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Only sender can delete
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    message.deleted = true;
    message.content = 'This message was deleted';
    message.attachment = undefined;
    await message.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==================== UTILITIES ====================

// GET /api/chat/students - Get students for teacher to chat with
router.get('/students', protect, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can access this' });
    }

    const students = await User.find({
      role: 'student',
      $or: [
        { teacher: req.user._id },
        { teacher: null },
        { teacher: { $exists: false } }
      ]
    }).select('name avatar color class');

    // Add online status
    const studentsWithStatus = students.map(s => ({
      ...s.toObject(),
      isOnline: isUserOnline(s._id)
    }));

    res.json(studentsWithStatus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/chat/unread - Get total unread count
router.get('/unread', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId
    });

    let totalUnread = 0;
    conversations.forEach(conv => {
      totalUnread += conv.unreadCounts?.get?.(userId.toString()) || 0;
    });

    res.json({ count: totalUnread });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/chat/online - Get online users
router.get('/online', protect, async (req, res) => {
  try {
    // This will be handled by socket events in frontend
    res.json({ message: 'Use socket events for online status' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;


const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Store connected users: Map<userId, socketId>
const connectedUsers = new Map();

// Store socket to user mapping
const socketToUser = new Map();

const initializeSocket = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'coined-secret');
      const user = await User.findById(decoded.id).select('_id name role');
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.user._id})`);
    
    // Add user to connected users
    connectedUsers.set(socket.user._id.toString(), socket.id);
    socketToUser.set(socket.id, socket.user._id.toString());

    // Join user's personal room for targeted messaging
    socket.join(`user:${socket.user._id}`);

    // Broadcast online status
    io.emit('user:online', { userId: socket.user._id });

    // Handle joining conversation rooms
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`User ${socket.user.name} joined conversation ${conversationId}`);
    });

    // Handle leaving conversation rooms
    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Handle typing indicators
    socket.on('typing:start', ({ conversationId, partnerId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        userId: socket.user._id,
        userName: socket.user.name,
        conversationId
      });
      
      // Also send to direct user if in 1-on-1
      if (partnerId) {
        const partnerSocketId = connectedUsers.get(partnerId);
        if (partnerSocketId) {
          io.to(partnerSocketId).emit('typing:start', {
            userId: socket.user._id,
            userName: socket.user.name,
            partnerId
          });
        }
      }
    });

    socket.on('typing:stop', ({ conversationId, partnerId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        userId: socket.user._id,
        conversationId
      });

      if (partnerId) {
        const partnerSocketId = connectedUsers.get(partnerId);
        if (partnerSocketId) {
          io.to(partnerSocketId).emit('typing:stop', {
            userId: socket.user._id,
            partnerId
          });
        }
      }
    });

    // Handle message sent (real-time notification)
    socket.on('message:send', (data) => {
      // Broadcast to conversation room
      socket.to(`conversation:${data.conversationId}`).emit('message:new', {
        message: data.message,
        conversationId: data.conversationId
      });
    });

    // Handle message read
    socket.on('message:read', ({ conversationId, messageId, userId }) => {
      socket.to(`conversation:${conversationId}`).emit('message:read', {
        messageId,
        userId: socket.user._id,
        conversationId
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name}`);
      
      connectedUsers.delete(socket.user._id.toString());
      socketToUser.delete(socket.id);
      
      // Broadcast offline status
      io.emit('user:offline', { userId: socket.user._id });
    });
  });

  return io;
};

// Helper functions
const getUserSocketId = (userId) => {
  return connectedUsers.get(userId.toString());
};

const isUserOnline = (userId) => {
  return connectedUsers.has(userId.toString());
};

const sendToUser = (io, userId, event, data) => {
  // First try to send to specific socket
  const socketId = connectedUsers.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
  // Also send to user's room (fallback)
  io.to(`user:${userId}`).emit(event, data);
};

const sendToConversation = (io, conversationId, event, data) => {
  io.to(`conversation:${conversationId}`).emit(event, data);
};

module.exports = {
  initializeSocket,
  connectedUsers,
  getUserSocketId,
  isUserOnline,
  sendToUser,
  sendToConversation
};


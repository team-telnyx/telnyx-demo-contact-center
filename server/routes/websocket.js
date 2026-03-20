import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

let io = null;

const initWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: env.CORS_ORIGINS.includes('*') ? '*' : env.CORS_ORIGINS,
      methods: ["GET", "POST"]
    }
  });

  // Authenticate socket connections with JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      socket.user = payload;
      next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { username } = socket.user;
    console.log(`Client connected: ${socket.id} (user: ${username})`);

    // Join user-specific and role-based rooms
    socket.join(`user:${username}`);
    if (socket.user.role) {
      socket.join(`role:${socket.user.role}`);
    }

    socket.on('message', (message) => {
      console.log('Received message:', message);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id} (user: ${username})`);
    });
  });

  io.on('error', (err) => {
    console.error('Socket.IO server error:', err);
  });
};

// Broadcast to all connected clients
const broadcast = (type, data) => {
  if (io) {
    io.emit(type, data);
  }
};

// Send to a specific user
const sendToUser = (username, type, data) => {
  if (io) {
    io.to(`user:${username}`).emit(type, data);
  }
};

// Send to all users with a specific role
const sendToRole = (role, type, data) => {
  if (io) {
    io.to(`role:${role}`).emit(type, data);
  }
};

export { initWebSocket, broadcast, sendToUser, sendToRole };

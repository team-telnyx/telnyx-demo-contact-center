let io = null;

const initWebSocket = (server) => {
  io = require('socket.io')(server, {
    cors: {
      origin: "*",  // This will allow all origins
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('message', (message) => {
      console.log('Received message:', message);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  io.on('error', (err) => {
    console.error('Socket.IO server error:', err);
  });
};

const broadcast = (type, data) => {
  io.emit(type, data);
};

module.exports = { initWebSocket, broadcast };

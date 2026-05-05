const jwt = require('jsonwebtoken');

module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    socket.join(`user_${userId}`);

    // Join/leave a report's comment room for real-time comment updates
    socket.on('join_report', (reportId) => {
      socket.join(`report_${reportId}`);
    });

    socket.on('leave_report', (reportId) => {
      socket.leave(`report_${reportId}`);
    });

    socket.on('typing', ({ to }) => {
      socket.to(`user_${to}`).emit('user_typing', { from: userId });
    });

    socket.on('stop_typing', ({ to }) => {
      socket.to(`user_${to}`).emit('user_stop_typing', { from: userId });
    });

    socket.on('disconnect', () => {
      socket.leave(`user_${userId}`);
    });
  });
};

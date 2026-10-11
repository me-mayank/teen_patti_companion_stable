const jwt = require('jsonwebtoken');
const User = require('../../modules/users/user.model');
const { requireGameAccess } = require('../middleware/gameAccess.middleware');
let ioInstance;
module.exports = {
  init: (io) => {
    ioInstance = io;
    io.use(async (socket, next) => {
      try {
        const decoded = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET || 'secret');
        const user = await User.findById(decoded.id).select('_id');
        if (!user) throw new Error('Player not found');
        socket.data.userId = user._id;
        next();
      } catch { next(new Error('Sign in to connect to the table')); }
    });
    io.on('connection', socket => {
      socket.on('joinGame', async (gameId, ack) => {
        try {
          await requireGameAccess(gameId, socket.data.userId, true);
          await socket.join(`game:${gameId}`);
          if (typeof ack === 'function') ack({ ok: true });
        } catch (error) { if (typeof ack === 'function') ack({ ok: false, message: error.message }); }
      });
      socket.on('leaveGame', gameId => socket.leave(`game:${gameId}`));
    });
  },
  getIO: () => {
    if (!ioInstance) throw new Error('Socket.io not initialized');
    return ioInstance;
  }
};

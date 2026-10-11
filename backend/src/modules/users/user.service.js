const User = require('./user.model');
const { fail } = require('../../shared/middleware/gameAccess.middleware');

const searchUsers = async (searchTerm = '') => {
  if (typeof searchTerm !== 'string') throw fail('Search must be text');
  const escaped = searchTerm.slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = escaped
    ? {
        $or: [
          { name: { $regex: escaped, $options: 'i' } },
          { username: { $regex: escaped, $options: 'i' } },
        ],
      }
    : {};
  return await User.find(query).select('name username profilePicture').limit(100);
};

const changeUsername = async (userId, newUsername) => {
  const mongoose = require('mongoose');
  const { recordTransaction } = require('../ledger/ledger.service');
  if (typeof newUsername !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) throw fail('Username must be 3–20 letters, numbers or underscores');
  const normalized = newUsername.toLowerCase();
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId).session(session);
      if (!user) throw fail('Player not found', 404);
      if (user.username === normalized) throw fail('Choose a different username');
      if (await User.exists({username:normalized}).session(session)) throw fail('Username is already taken');
      const Game = require('../games/game.model');
      const games = await Game.find({'participants.userId':userId,status:{$nin:['ENDED','ARCHIVED']}}).session(session);
      const available = user.globalBalance + games.reduce((sum,g)=>sum+(g.participants.find(p=>String(p.userId)===String(userId))?.balance || 0),0);
      if (available < 1000) throw fail('Insufficient available balance to change username. ₹1,000 required.');
      user.globalBalance -= 1000;
      user.username = normalized;
      user.increment();
      await user.save({ session });
      await recordTransaction(session, { userId, type:'FEE', amount:-1000 });
      result = user;
    });
  } finally { await session.endSession(); }
  return result;
};

const updateProfilePicture = async (userId, profilePictureUrl) => {
  if (typeof profilePictureUrl !== 'string' || profilePictureUrl.length > 2048 || (profilePictureUrl && !/^https?:\/\//i.test(profilePictureUrl))) throw fail('Use a valid http or https image URL');
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  
  user.profilePicture = profilePictureUrl;
  await user.save();
  return user;
};

module.exports = {
  searchUsers,
  changeUsername,
  updateProfilePicture,
};

// Disposable local demonstration. No production database is read or modified.
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const http = require('node:http');
const { Server } = require('socket.io');
const app = require('../app');
const User = require('../src/modules/users/user.model');
const Game = require('../src/modules/games/game.model');
const { init } = require('../src/shared/sockets');

async function main() {
  const database = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { downloadDir:'/tmp/teen-patti-mongodb' } });
  await mongoose.connect(database.getUri());
  const passwordHash = await bcrypt.hash('TeenPattiDemo1!', 10);
  const names = ['Aarav', 'Meera', 'Kabir', 'Isha', 'Rohan', 'Diya'];
  const players = await User.create(names.map((name,index) => ({ name, username:`demo${index+1}`,email:`demo${index+1}@example.test`,passwordHash,globalBalance:10000 })));
  for (const mode of ['JOKER', 'CLASSIC']) {
    await Game.create({ name:`Demo · ${mode === 'JOKER' ? 'Joker night' : 'Classic table'}`, mode, bootAmount:10, maxBetMultiplier:16, createdBy:players[0]._id, status:'ACTIVE',
      participants:players.map(user => ({ userId:user._id })),turnOrder:players.map(user=>user._id),startedAt:new Date() });
  }
  const showPlayers = players.slice(0, 2);
  await Game.create({ name:'Demo · Two-player Show', mode:'CLASSIC', bootAmount:10, maxBetMultiplier:16, createdBy:players[0]._id, status:'ACTIVE',
    participants:showPlayers.map(user => ({ userId:user._id })),turnOrder:showPlayers.map(user=>user._id),startedAt:new Date() });
  const server = http.createServer(app);
  const io = new Server(server, { cors:{ origin:[process.env.CLIENT_URL || 'http://localhost:5173','http://127.0.0.1:5173'], methods:['GET','POST','PATCH'] } });
  init(io);
  server.listen(5000, '127.0.0.1', () => console.log('Disposable demo API: http://127.0.0.1:5000\nPlayers: demo1@example.test through demo6@example.test\nPassword: TeenPattiDemo1!\nDemo 1 is the host.\nShow testing: enter Demo · Two-player Show as demo1 and demo2 in separate browser profiles.\nAll balances are synthetic. Data disappears when this process stops.'));
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; io.close(); server.close(); await mongoose.disconnect(); await database.stop(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
main().catch(error => { console.error(error); process.exit(1); });

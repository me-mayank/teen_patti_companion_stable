const { evaluateHand } = require('../cards/cards.service');
const idOf = value => String(value?._id || value || '');

function roundForViewer(round, viewerId) {
  if (!round) return null;
  const source = round.toObject ? round.toObject() : round;
  // Copy only the objects we redact. structuredClone strips ObjectId
  // serialization from lean database results and breaks HTTP identifiers.
  const view = { ...source };
  view.players = view.players.map(player => {
    player = { ...player };
    const visible = (idOf(player.userId) === idOf(viewerId) && player.seenCards)
      || player.sideShowViewers?.some(id => idOf(id) === idOf(viewerId))
      || (view.status === 'COMPLETED' && player.revealed);
    const cards = player.cards;
    delete player.cards;
    delete player.handRank;
    delete player.sideShowViewers;
    if (visible && cards?.length === 3) {
      player.cards = cards;
      player.handRank = evaluateHand(cards, view.jokerCard?.rank).label;
    }
    return player;
  });
  return view;
}
module.exports = { roundForViewer, idOf };

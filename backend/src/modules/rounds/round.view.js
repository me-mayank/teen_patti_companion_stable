const { evaluateHand } = require('../cards/cards.service');
const idOf = value => String(value?._id || value || '');

function roundForViewer(round, viewerId) {
  if (!round) return null;
  const view = round.toObject ? round.toObject() : structuredClone(round);
  view.players = view.players.map(player => {
    const visible = (idOf(player.userId) === idOf(viewerId) && player.seenCards)
      || (view.status === 'COMPLETED' && player.revealed);
    const cards = player.cards;
    delete player.cards;
    delete player.handRank;
    if (visible && cards?.length === 3) {
      player.cards = cards;
      player.handRank = evaluateHand(cards, view.jokerCard?.rank).label;
    }
    return player;
  });
  return view;
}
module.exports = { roundForViewer, idOf };

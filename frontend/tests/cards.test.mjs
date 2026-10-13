import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { rolldown } from 'rolldown';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const entry = fileURLToPath(new URL('../src/features/rounds/components/PlayingCard.jsx', import.meta.url));

const bundle = await rolldown({ input: entry, external: id => id !== entry, transform: { jsx: { runtime: 'classic' } } });
const { output } = await bundle.generate({ format: 'cjs', exports: 'named' });
await bundle.close();
const module = { exports: {} };
new vm.Script(output[0].code).runInNewContext({ React, module, exports: module.exports,
  require: name => name === 'react' ? React : name });
const { CardHand } = module.exports;
const PlayingCard = module.exports.default;
const render = props => renderToStaticMarkup(React.createElement(PlayingCard, props));

// Measured ink extents of both scans in the logical 1440×1800 canvas, including
// both indices and every pip/court. Eight pixels protect the rounded edges.
test('every face keeps its entire printed artwork inside the rounded card with a safe border', () => {
 for (const [asset, fixture] of [['bicycle-sheet.png', 'bicycle-ink-bounds.json'], ['bicycle-sheet-enhanced.png', 'bicycle-enhanced-ink-bounds.json']]) {
  const inkFixture = JSON.parse(readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url)));
  const source = readFileSync(new URL(`../src/assets/cards/${asset}`, import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), inkFixture.sourceSha256);
  for (const [code, [left, top, right, bottom]] of Object.entries(inkFixture.bounds)) {
    if (code === 'J-grey') continue;
    const [suit, label] = code.split('-');
    const rank = ({ A: 14, K: 13, Q: 12, J: 11 })[label] ?? Number(label);
    const html = render({ card: { rank, suit } });
    const [x, y, width, height] = html.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    assert.ok(x <= left - 8 && y <= top - 8 && x + width >= right + 8 && y + height >= bottom + 8,
      `${code}: crop ${[x,y,width,height]} clips printed artwork ${[left,top,right,bottom]} or its safe border`);
  }
 }
});

function assertSelfContained(svg) {
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Multiple copies of a card must not share fragment IDs');
  const references = [...svg.matchAll(/(?:href="|url\()([^")]+)/g)].map(match => match[1]);
  assert.ok(references.length > 0, 'Card art must actually be present');
  for (const reference of references) {
    if (reference.startsWith('#')) assert.ok(ids.includes(reference.slice(1)), `Missing artwork fragment ${reference}`);
    else assert.ok(reference.endsWith('bicycle-sheet-enhanced.png') || reference.endsWith('bicycle-back-enhanced.png'), `Unrecognized artwork: ${reference}`);
  }
}

test('every face, printed joker and back uses the enhanced Bicycle artwork', () => {
  assertSelfContained(render({}));
  const joker = render({card:{rank:0,suit:'J'}});
  assertSelfContained(joker);
  assert.ok(joker.includes('Printed joker, wild card'));
  assert.ok(joker.includes('WILD'));
  for (const suit of ['C', 'D', 'H', 'S']) {
    for (let rank = 2; rank <= 14; rank++) {
      const html = render({ card: { rank, suit } });
      assertSelfContained(html);
      assert.ok(html.includes('role="img"'));
      assert.ok(html.includes(' of '));
    }
  }
});

test('revealing and replacing a hand retains artwork, including duplicate seat and show copies', () => {
  const cards = [{ rank: 10, suit: 'C' }, { rank: 6, suit: 'S' }, { rank: 11, suit: 'S' }];
  for (const shownCards of [undefined, cards, undefined, [...cards].reverse(), cards]) {
    const html = renderToStaticMarkup(React.createElement('div', null,
      ...[false, true, false].map((small, i) => React.createElement(CardHand, { key: i, cards: shownCards, small, jokerRank: 6 }))));
    assertSelfContained(html);
    assert.equal([...html.matchAll(/role="img"/g)].length, 9);
    assert.equal([...html.matchAll(/Face-down card/g)].length, shownCards ? 0 : 9);
    assert.equal([...html.matchAll(/, joker/g)].length, shownCards ? 3 : 0);
  }
});

const seatEntry = fileURLToPath(new URL('../src/features/rounds/components/PlayerCircle.jsx', import.meta.url));
const seatBundle = await rolldown({ input: seatEntry, external: id => id !== seatEntry, transform: { jsx: { runtime: 'classic' } } });
const seatOutput = await seatBundle.generate({ format: 'cjs' });
await seatBundle.close();
const seatModule = { exports: {} };
new vm.Script(seatOutput.output[0].code).runInNewContext({ React, module: seatModule, exports: seatModule.exports,
  require: name => name === 'lucide-react' ? { Crown: () => null } : { CardHand: () => null } });
const PlayerCircle = seatModule.exports.default || seatModule.exports;
test('a current player keeps their last action and bet amount alongside the turn marker', () => {
  for (const [lastAction, label] of [['BLIND', 'Blind'], ['SEEN', 'Seen'], ['CHAAL', 'Chaal']]) {
    const html = renderToStaticMarkup(React.createElement(PlayerCircle, { isMe: false, isCurrentTurn: true,
      player: { userId: { name: 'Opponent' }, status: 'ACTIVE', seenCards: lastAction !== 'BLIND', lastAction, lastBet: 'BLIND', lastBetAmount: 40, totalContribution: 80 } }));
    assert.ok(html.includes(`seat-status">${label}`));
    assert.ok(html.includes('Blind · ₹40'));
    assert.ok(html.includes('seat-turn">Turn'));
    assert.ok(!html.includes('Playing'));
  }
});

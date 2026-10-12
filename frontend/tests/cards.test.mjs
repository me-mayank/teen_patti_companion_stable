import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { rolldown } from 'rolldown';

const entry = fileURLToPath(new URL('../src/features/rounds/components/PlayingCard.jsx', import.meta.url));
const artwork = JSON.parse(await readFile(new URL('../src/assets/card-artwork.json', import.meta.url), 'utf8'));
const bundle = await rolldown({ input: entry, external: id => id !== entry, transform: { jsx: { runtime: 'classic' } } });
const { output } = await bundle.generate({ format: 'cjs', exports: 'named' });
await bundle.close();
const module = { exports: {} };
new vm.Script(output[0].code).runInNewContext({ React, module, exports: module.exports,
  require: name => name === 'react' ? React : artwork });
const { CardHand } = module.exports;
const PlayingCard = module.exports.default;
const render = props => renderToStaticMarkup(React.createElement(PlayingCard, props));

function assertSelfContained(svg) {
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Multiple copies of a card must not share fragment IDs');
  const references = [...svg.matchAll(/(?:href="|url\()([^")]+)/g)].map(match => match[1]);
  assert.ok(references.length > 0, 'Card art must actually be present');
  for (const reference of references) {
    assert.ok(reference.startsWith('#'), `Card rendering must not depend on an external asset: ${reference}`);
    assert.ok(ids.includes(reference.slice(1)), `Missing artwork fragment ${reference}`);
  }
}

test('every face and back renders complete artwork without fetching an external sprite', () => {
  assertSelfContained(render({}));
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

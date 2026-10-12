"""Build self-contained jumbo-index artwork from the licensed vector deck."""
from pathlib import Path
import copy, json, re
import xml.etree.ElementTree as ET

base = Path(__file__).resolve().parents[1]
root = ET.parse(base / 'src/assets/cards.svg').getroot()
ns = {'s': 'http://www.w3.org/2000/svg'}
ET.register_namespace('', ns['s'])
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
link = '{http://www.w3.org/1999/xlink}href'
artwork = {}
for card in root:
    code = card.get('id')
    if code == 'B-1':
        # Original red ornamental back, without a third-party game mark.
        artwork[code] = ''.join(ET.tostring(n, encoding='unicode') for n in card)
        continue
    nodes = list(card)
    definitions = nodes[0]
    index = next(n for n in nodes if n.tag.endswith('use') and n.get('height') == '32')
    suit = next(n for n in nodes if n.tag.endswith('use') and n.get('height') == '26.769')
    body = [n for n in nodes[2:] if n is not index and n is not suit and not n.tag.endswith('g')]
    # Court art retains its two-ended figure; number cards retain actual pip counts.
    rendered = [copy.deepcopy(definitions), copy.deepcopy(nodes[1])]
    group = ET.Element('g', {'transform': 'translate(28 24) scale(.78)'})
    for n in body:
        if n.get(link, '').split('-')[-1].startswith('X'):
            continue
        group.append(copy.deepcopy(n))
    # Number-card bottom pips live in the rotated group.
    if code.split('-')[1] not in ['J','Q','K']:
        for n in nodes:
            if n.tag.endswith('g'):
                g = copy.deepcopy(n)
                for child in list(g):
                    if child.get('height') in ['32', '26.769']:
                        g.remove(child)
                group.append(g)
    rendered.append(group)
    corner_rank = copy.deepcopy(index)
    corner_rank.attrib.update(x='-109', y='-152', width='70', height='74')
    corner_suit = copy.deepcopy(suit)
    corner_suit.attrib.update(x='-101', y='-73', width='52', height='52')
    rendered.extend([corner_rank, corner_suit])
    markup = ''.join(ET.tostring(n, encoding='unicode') for n in rendered)
    artwork[code] = re.sub(r' xmlns(?::xlink)?="[^"]+"', '', markup)
output = base / 'src/assets/card-artwork.json'
output.write_text(json.dumps(artwork, separators=(',', ':')) + '\n')
print(f'Built {len(artwork)} self-contained card designs.')

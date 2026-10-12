The classic card faces in ../cards.svg are adapted from Adrian Kennard's
public-domain playing cards, distributed under CC0 1.0 Universal.

Original author and dedication: https://www.me.uk/cards/
SVG source: https://github.com/letele/playing-cards/tree/865a78eb940c1232e4b21523577c8fca52f694fe/assets
License: https://creativecommons.org/publicdomain/zero/1.0/

The SVG files are combined into one sprite, fragment identifiers are prefixed,
and path coordinates are rounded for screen display. The red patterned back
adds two original ornamental medallions. No Bicycle branding or artwork is used.

`card-artwork.json` is generated from this licensed source by
`frontend/scripts/build-card-artwork.py`. It adds jumbo corner indices, a shifted
pip/court layout, and self-contained per-card definitions. Each rendered copy
scopes its fragment identifiers independently.

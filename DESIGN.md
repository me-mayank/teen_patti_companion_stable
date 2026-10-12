---
name: Teen Patti Companion
description: The incumbent warm black and gold app, extended by a playable felt card table.
colors:
  slate-950: "#070606"
  slate-900: "#12100F"
  slate-800: "#1A1714"
  slate-700: "#3D2B18"
  slate-400: "#AAA39A"
  white: "#F5F1E8"
  emerald-500: "#D7A656"
  emerald-400: "#F6E59B"
  red-500: "#C62828"
  table-bg: "#100d0b"
  table-header: "#1e1813"
  table-control: "#34281c"
  table-gold: "#e3b86a"
  table-text: "#fbf3e5"
  table-muted: "#d7c6ad"
  felt-deep: "#093d2b"
  felt-light: "#328968"
  rail: "#75502d"
  card-face: "#ffffff"
  card-black: "#000000"
  card-red: "#ff0000"
  card-back: "#971e2b"
  wild: "#f2be51"
  focus: "#ffe1a0"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
  table-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
    fontSize: "13px"
    fontWeight: 650
  table-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
    fontSize: "13px"
  pot:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
    fontSize: "40px"
    fontWeight: 750
    lineHeight: 1.3
  table-wordmark:
    fontFamily: "Georgia, serif"
    fontSize: "25px"
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  card: "7px"
  table-control: "10px"
  panel: "12px"
  form-card: "16px"
  avatar: "50%"
spacing:
  compact: "8px"
  regular: "16px"
  generous: "24px"
components:
  table-primary:
    backgroundColor: "{colors.table-gold}"
    textColor: "#281b0c"
    rounded: "{rounded.table-control}"
    padding: "12px 18px"
  table-secondary:
    backgroundColor: "{colors.table-control}"
    textColor: "{colors.table-text}"
    rounded: "{rounded.table-control}"
    padding: "12px 18px"
  table-pack:
    backgroundColor: "#49252a"
    textColor: "#ffb6b6"
    rounded: "{rounded.table-control}"
    padding: "12px 18px"
  playing-card:
    backgroundColor: "{colors.card-face}"
    textColor: "{colors.card-black}"
    rounded: "{rounded.card}"
    width: "110px"
    height: "154px"
  setup-input:
    backgroundColor: "{colors.slate-950}"
    textColor: "{colors.white}"
    rounded: "{rounded.panel}"
    padding: "12px 16px"
  setup-card:
    backgroundColor: "{colors.slate-900}"
    rounded: "{rounded.form-card}"
    padding: "24px"
---

# Design System: Teen Patti Companion

## Overview

**Creative North Star: "The warm black-and-gold table"**

This record captures the existing app identity and the implemented game-table extension. Warm near-black surfaces, cream text and gold controls continue the palette in `frontend/src/index.css`. The new green felt is specific to the card table; it does not replace the surrounding app's identity. This is a descriptive scan of the implementation, not a newly commissioned brand direction.

The table is an operating surface: the player's hand, stake, active turn and available actions take priority over decorative detail. Teen Patti Gold's official store screenshots informed the felt oval, radial seating, card fans and dedicated action row. No reference artwork or branding was copied. The table combines CSS geometry with original generated lounge and dealer artwork; the classic vector card deck is shared by all hands. No PRODUCT.md was supplied.

**Key Characteristics:**

- Warm black and gold app surfaces with a green felt table extension.
- Radial seats with the signed-in participant anchored at the bottom.
- Cream face-up cards, burgundy backs and labelled wild-card states.
- Persistent action positions while an active participant waits for a turn.
- Portrait mobile play with a separate full-size hand below the table.

## Colors

The incumbent palette is warm and muted; the table adds felt green and a slightly lighter gold to keep cards and stakes readable.

### Primary

- **App gold** (`emerald-500`) is the incumbent primary-action color; **light app gold** (`emerald-400`) supports headings and hover states. These historical token names resolve to gold, despite their emerald names.
- **Table gold** (`table-gold`) marks the main betting action and the inner rail. Turn outlines use a nearby warm gold; wild cards use the brighter `wild` token with explicit WILD text.

### Secondary

- **Felt green** (`felt-deep`, `felt-light`) forms the oval's radial gradient and is reserved for the playing surface.
- **Burgundy card backs** (`card-back`) distinguish concealed cards. **Red suits** (`card-red`) distinguish hearts and diamonds alongside their suit symbols.

### Neutral

- **App warm black surfaces** (`slate-950`, `slate-900`, `slate-800`) and **brown borders** (`slate-700`) remain the surrounding app's surface vocabulary.
- **App cream** (`white`) and **muted app text** (`slate-400`) carry existing content.
- **Table warm black** (`table-bg`), **header brown** (`table-header`) and **control brown** (`table-control`) distinguish the game screen, navigation and secondary actions.
- **Table cream** (`table-text`) and **muted sand** (`table-muted`) support game content and supporting labels.
- **Card ivory** (`card-face`) and **dark suits** (`card-black`) keep revealed hands distinct from felt. **Rail brown** (`rail`) frames the oval.

**The state-plus-label Rule.** Gold highlights and suit colors accompany text or symbols: Your turn, Playing, Packed, Winner, WILD and the rank/suit description carry the meaning.

## Typography

**Body and controls:** The existing system sans-serif stack from `frontend/src/index.css`.

**Table wordmark and card-back mark:** Georgia with a serif fallback.

The sans-serif carries names, actions, balances and status. Georgia supplies the understated table wordmark and TP mark on card backs. The table uses tabular numerals for financial values.

The desktop table name is compact (13px) and sits beside individual mode, round and boot value chips (12px); action labels are medium-bold (14px) and action amounts are heavier (17px). The pot is the strongest figure (40px, weight 750, line height 1.3). On mobile, the table name remains available to screen readers, value chips become 11px (10px on the narrowest screens), action labels become 12px and the pot 28px. The table wordmark becomes 15px. These are component roles, not an app-wide display scale.

## Layout

Existing setup forms use a centered, bounded column with inset cards; the game table has its own geometry. The table stage is at most 1180px wide. A 232px standing dealer sits centrally behind a 400px arena with a straight top rail and rounded ends. On desktop viewports at most 850px tall, the dealer becomes 180px tall and the arena becomes 410px tall. The hand and action area below is at most 860px wide. The transparent top controls use 16px horizontal padding (8px on mobile), while footer padding remains 28px; the play area uses 24px horizontal padding on desktop.

Two to six occupied seats follow count-specific positions around the rail, leaving the top-center space for the dealer. A signed-in participant is reordered into the bottom position. A spectator keeps the available ordering without an invented own seat. The pot and optional joker indicator share the center. The player's full-size fan sits immediately below their avatar, with the caption and balance below it. The same fan remains in place after a show. Other server-visible hands enlarge beside their seats; concealed hands remain red backs. A completed-round winner message appears above the central pot.

At 600px and below, the dealer is 144px tall and the arena is 420px tall, with a taller oval. Upper seats shift to leave the rail and standing dealer readable, and side seats are bounded away from screen edges. The play area uses 12px horizontal padding. Main cards become 84×118px; concealed seat cards are 36×50px and revealed seat cards 44×62px. The four action columns remain in place; at 370px and below they become two columns. No layout requires landscape orientation. The action area is in document flow, not fixed to the viewport. Long names truncate and retain the full name in a title.

**The anchored-action Rule.** During an active round, keep Pack, Blind/Chaal, Raise and Show/Side show in stable positions for the active participant; disable ineligible controls without removing them.

## Elevation & Depth

The surrounding app uses dark tonal surfaces and occasional gold-tinted shadows. The table adds material depth only where its geometry calls for it: a recessed felt surface, a raised rail and a small shadow behind each card. The dim table wordmark sits behind play content.

The felt combines inset gold edging, inset shade and an external shadow (`inset 0 0 0 2px #e3b86a, inset 0 6px 28px #0b3526, 0 14px 30px #080705`). Cards use a compact shadow (`0 3px 8px #0005`). These snippets and the deal motion are recorded in the sidecar.

## Shapes

The signature table silhouette is an oval with a substantial brown rail and thin inner edging. Its straight center rail transitions into 180px rounded ends on desktop and 110px ends on mobile. Player avatars are circles. Full-size cards use small rounded corners (7px); small cards use 4px. Table action controls use 10px corners; navigation controls and rules/confirmation panels use 12px. Existing form containers use 16px corners.

## Components

### Buttons

Table controls are substantial, readable actions with a minimum height of 46px, 12px by 18px padding and a short background transition (150ms). The primary bet uses table gold; secondary controls use brown; Pack uses a muted burgundy background with pale red text. Hover deepens brown controls or lightens gold. Disabled table actions use 45% opacity and a not-allowed cursor. Keyboard focus on table buttons and links is a 3px pale-gold outline with 4px offset.

### Navigation

The table has a compact row of floating controls over the lounge background, with no full-width header fill or divider. The game name appears in a small truncated chip on desktop and remains accessible but visually hidden on mobile. Separate static chips show mode, round and boot amount; they resemble compact controls without pretending to be interactive buttons. The live indicator, rules toggle, history link and back link remain available.

Navigation icons have a 36px visible surface within a 44px click/touch target. Value chips are 32px tall and use gold numeric values against a warm dark surface. Desktop controls occupy 60px vertically; mobile controls occupy 52px. Mobile hides connection text, and the narrowest breakpoint hides the connection indicator. Rules and history keep explicit accessible names and keyboard focus.

### Lounge and dealers

The table screen has an original illustrated private card lounge: burgundy velvet curtains, walnut architecture and warm chandelier lighting. A dark overlay keeps gameplay readable; the hand and action area has a quiet warm-black surface. The felt is a brighter emerald with a layered gold-and-walnut rail. This artwork is confined to the game screen.

A standing dealer centered behind the top rail offers two original adult female characters: Anaya in an emerald waistcoat and Tara in a burgundy sari. Their standing cutouts have transparent backgrounds, with outstretched arms and hands resting across the rail. The selector sits independently in the upper-right corner. The two labelled buttons use `aria-pressed`, keyboard focus and at least 44px touch height. Selecting a dealer changes only that viewer's decoration and saves their choice in browser storage. Storage failures fall back gracefully. Mobile reduces the portrait and stacks the controls without hiding the choices. Player fans are drawn in front of the dealer hands.

### Cards and hands

Each hand always renders three cards. Without card data, it renders three backs. Faces use jumbo corner ranks and suit symbols, traditional pip counts, and licensed court artwork, following the supplied gameplay references. They expose a spoken rank/suit description and label matching joker-rank cards WILD with a gold outline. Full-size cards are 110×154px, concealed seat cards 50×70px and revealed seat cards 70×98px on desktop. Cards overlap by roughly two fifths of their width with a nine-degree outer fan.

Every card SVG includes its own artwork and uniquely scoped fragments. Rendering a face needs no external sprite request, including during a blind-to-seen transition or when the same hand is shown in two places. `frontend/scripts/build-card-artwork.py` regenerates the bundled designs from the licensed source deck. The UI renders only card information received from the server; this visual convention does not establish privacy by itself.

Backs enter with a short vertical deal animation (180ms). Reduced-motion preferences remove it and remove table transitions.

### Player seats and status chips

Seats combine a three-card fan, circular avatar/initial, name, status and amount contributed. The current seat has a gold avatar outline and gold status chip. The participant's own current seat says Your turn; an opponent's current seat says Playing. Other states say Blind, Seen, Packed or Winner. Packed avatars are dimmed and winners receive a crown. These labels describe status, rather than replacing it with color alone.

### Pot and joker indicator

The pot combines a coin icon, Table pot label, large amount, blind-stake caption and fixed 100× boot pot-limit caption. Joker mode places one small face-up indicator beside it with a rank-is-wild label and All four suits caption. Mobile stacks the indicator card above its description. The wild indicator is separate from the players' card fans.

### Round messages and action panel

The action panel announces whose turn it is and shows four controls while the round and participant are active. Amounts reflect blind/seen stakes, limited to the amount remaining before the pot cap. Near the cap, an explanation announces automatic comparison. Capped-round results identify the winner or each tied winner and their share. Show/Side show carry explanatory titles and change according to the number of active players. Other disable reasons rely on state and the rules panel; the UI does not give every disabled control a dedicated explanation.

Completion keeps the participant’s fan visible and replaces the betting controls with a winner message and host-only next-deal action. Digital Show reports automatic comparison; Side show presents accept/decline controls to its target and a resolved status after comparison. Earlier physical-card rounds retain their explicit manual-result flow. Rules and end-game confirmation are bounded in-flow panels, not overlay dialogs. Loading, unavailable-table, setup and finished-game states have their own centered messages/actions.

### Existing setup fields and containers

Setup fields retain the incumbent near-black fill, brown border, cream text, 12px corners and 12px by 16px padding. Focus shifts the field border to app gold. Setup cards retain the warm surface fill, subtle elevated-surface border, 16px corners and 24px padding. The game table itself has no text fields.

## Do's and Don'ts

### Do:

- **Do** preserve the surrounding app's warm black/gold palette and system font stack.
- **Do** keep the signed-in participant at the bottom of radial seating when they have a seat.
- **Do** pair turn, concealment, pack and wild-card treatments with readable status or card descriptions.
- **Do** keep the full-size participant hand separate from the small seat fans.
- **Do** retain table keyboard focus and reduced-motion treatment when extending table controls.
- **Do** preserve server-provided card visibility when adding UI views.

### Don't:

- **Don't** treat historical emerald token names as permission to recolor the incumbent app green.
- **Don't** turn the table's radial seating into the layout for unrelated app screens.
- **Don't** fabricate or reveal concealed opponent cards in the client.
- **Don't** label an opponent's current turn Your turn.
- **Don't** move active-round betting actions when they become unavailable.
- **Don't** introduce copied reference branding or artwork into this table.

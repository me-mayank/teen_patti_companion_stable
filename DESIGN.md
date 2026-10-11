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
  table-muted: "#c3b69f"
  felt-deep: "#154b35"
  felt-light: "#23694c"
  rail: "#644627"
  card-face: "#fffcf5"
  card-black: "#1b2422"
  card-red: "#b32232"
  card-back: "#8b2631"
  wild: "#f2be51"
  focus: "#ffe1a0"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
  table-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
    fontSize: "20px"
    fontWeight: 700
  table-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
    fontSize: "13px"
  pot:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif"
    fontSize: "34px"
    fontWeight: 750
    lineHeight: 1.3
  table-wordmark:
    fontFamily: "Georgia, serif"
    fontSize: "23px"
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
    width: "64px"
    height: "88px"
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

The table is an operating surface: the player's hand, stake, active turn and available actions take priority over decorative detail. Teen Patti Gold's official store screenshots informed the felt oval, radial seating, card fans and dedicated action row. No reference artwork or branding was copied. The table uses CSS geometry, suit characters and existing icon components rather than new image assets. No PRODUCT.md was supplied.

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

The desktop table title is bold (20px), supporting header text is compact (13px), action labels are medium-bold (14px) and action amounts are heavier (17px). The pot is the strongest figure (34px, weight 750, line height 1.3). On mobile, the title becomes 16px, action labels 12px and the pot 25px. The table wordmark becomes 15px. These are component roles, not an app-wide display scale.

## Layout

Existing setup forms use a centered, bounded column with inset cards; the game table has its own radial geometry. The table stage is at most 900px wide and 440px tall, increasing to 450px above the 1100px breakpoint. The play area below is at most 720px wide. Header/footer padding is 28px horizontally; the play area uses 24px horizontal padding on desktop.

Two to six occupied seats are distributed equally around the oval. A signed-in participant is reordered into the bottom position. A spectator who has no seat sees the available ordering without an invented own seat. The pot and optional joker indicator share the center. The player's full-size hand sits in a separate area below the stage.

At 600px and below, the stage is 400px tall, seats/avatars/card fans shrink, and the oval becomes taller relative to its width. The play area uses 14px horizontal padding, and the hand area may wrap. The four action columns remain in place; at 370px and below they become two columns and the stage is 390px tall. No layout requires landscape orientation. The action area is in document flow, not fixed to the viewport. Long names truncate and retain the full name in a title.

**The anchored-action Rule.** During an active round, keep Pack, Blind/Chaal, Raise and Show/Side show in stable positions for the active participant; disable ineligible controls without removing them.

## Elevation & Depth

The surrounding app uses dark tonal surfaces and occasional gold-tinted shadows. The table adds material depth only where its geometry calls for it: a recessed felt surface, a raised rail and a small shadow behind each card. The dim table wordmark sits behind play content.

The felt combines inset gold edging, inset shade and an external shadow (`inset 0 0 0 2px #e3b86a, inset 0 6px 28px #0b3526, 0 14px 30px #080705`). Cards use a compact shadow (`0 3px 8px #0005`). These snippets and the deal motion are recorded in the sidecar.

## Shapes

The signature table silhouette is an oval with a substantial brown rail and thin inner edging. Its corner geometry changes from 48% on desktop to 45% on mobile. Player avatars are circles. Full-size cards use small rounded corners (7px); small cards use 4px. Table action controls use 10px corners; navigation controls and rules/confirmation panels use 12px. Existing form containers use 16px corners.

## Components

### Buttons

Table controls are substantial, readable actions with a minimum height of 46px, 12px by 18px padding and a short background transition (150ms). The primary bet uses table gold; secondary controls use brown; Pack uses a muted burgundy background with pale red text. Hover deepens brown controls or lightens gold. Disabled table actions use 45% opacity and a not-allowed cursor. Keyboard focus on table buttons and links is a 3px pale-gold outline with 4px offset.

### Navigation

The table header contains a back link, truncated game title, mode/round/boot summary, connection indicator, rules toggle and history link. Icon controls have a minimum height of 44px; their desktop width is at least 44px, reducing to 36px on mobile. Connection text hides on mobile while the icon remains; the entire indicator hides at the narrowest breakpoint. Hover brightens the control surface and text.

### Cards and hands

Each hand always renders three cards. Without card data, it renders three backs. Faces show rank and suit, expose a spoken rank/suit description, and label matching joker-rank cards WILD with a gold outline. Card fans accompany the player seats; the participant's larger hand appears below the table while the round is unfinished. The UI renders card information received from the server; this visual convention does not establish privacy by itself.

Cards enter with a short staggered vertical deal animation (350ms, 80ms per-card delay). Reduced-motion preferences remove it and remove table transitions.

### Player seats and status chips

Seats combine a three-card fan, circular avatar/initial, name, status and amount contributed. The current seat has a gold avatar outline and gold status chip. The participant's own current seat says Your turn; an opponent's current seat says Playing. Other states say Blind, Seen, Packed or Winner. Packed avatars are dimmed and winners receive a crown. These labels describe status, rather than replacing it with color alone.

### Pot and joker indicator

The pot combines a coin icon, Table pot label, large amount and blind-stake caption. Joker mode places one small face-up indicator beside it with a rank-is-wild label and All four suits caption. Mobile stacks the indicator card above its description. The wild indicator is separate from the players' card fans.

### Round messages and action panel

The action panel announces whose turn it is and shows four controls while the round and participant are active. Amounts reflect blind/seen stakes. Show/Side show carry explanatory titles and change according to the number of active players. Other disable reasons rely on state and the rules panel; the UI does not give every disabled control a dedicated explanation.

Completion replaces normal play with a winner message and host-only next-deal action. Digital Show reports automatic comparison; Side show presents accept/decline controls to its target and a resolved status after comparison. Earlier physical-card rounds retain their explicit manual-result flow. Rules and end-game confirmation are bounded in-flow panels, not overlay dialogs. Loading, unavailable-table, setup and finished-game states have their own centered messages/actions.

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

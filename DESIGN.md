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
    width: "76px"
    height: "106px"
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

The table is an operating surface inside the existing warm black-and-gold app. The lounge, green felt, walnut rail, system text and selectable dealers remain the visual identity. The supplied Teen Patti Gold screenshots inform the compact fan and table composition; only the explicitly supplied Bicycle pack artwork is reused.

## Table layout

The board occupies 100dvh with a flexible table stage, compact header, persistent action dock and footer. The stage takes the height remaining after controls, rather than adding a fixed-height table and a second hand section. Two to six seats sit around the rail. The viewer's overlapping hand sits at the bottom of the arena, above betting controls. Rules, end-game confirmation and private side-show comparisons use native dialogs with focus management, Escape dismissal and a bounded internal scroll area. Routine play does not require document scrolling.

Portrait layouts use a tall felt oval, compact seat fans and four stable action columns. Narrow screens retain all action targets. Short landscape layouts omit the decorative dealer portrait and position the viewer's status beside their fan, keeping the central pot and upper cards clear of the header. Other screens show the dealer standing behind the rail. Dealer choices are local and remembered; gameplay remains on the server.

## Cards

The active deck uses SVG windows into an image-generated enhancement of the user-supplied Bicycle face sheet, including the printed joker. Rich reds, deep blacks, clean whites and vivid court details correct the original photograph's uneven fading. The bitmap maps into the original 1440×1800 logical canvas; white margins preserve both indices and every pip. The enhanced red back is a complete upright image reconstructed from the partly obscured reference. Source images and final generation prompts are preserved. Both active images preload and are included in the PWA cache. The old CC0 deck remains an unused reference asset. Attribution is recorded in `frontend/src/assets/licenses/cards.md`.

Main cards are 76×106px with a 44px overlap and seven-degree outer fan. At short heights they reduce to 64×90px; short landscape uses 48×67px. Opponent cards are 40×56px, or 48×67px when revealed. Portrait opponent cards are smaller. Card geometry responds to both viewport width and height. Every hand contains three cards, with spoken labels and a labelled gold outline for wild cards. Reduced motion removes deal and celebration animations.

## Player states and amounts

Seat status preserves the last action: Blind, Seen or Chaal, superseded by Packed or Winner when appropriate. A separate turn marker and avatar outline identify the current player. The latest Blind/Chaal amount appears beneath the state; before any bet, the boot appears instead. Total contribution is available in the amount's title. Opening cards sets Seen; a later paid seen bet sets Chaal. Last bet amounts remain visible after packing.

## Rules and results

New tables default to a blind limit of 16× boot. Chaal costs twice the blind stake, and Show costs twice the current chaal for either a blind or seen requester. Payments stop at the 100× boot pot limit. Joker mode deals two normal cards and one printed wild joker per person. Earlier rank-joker rounds remain compatible.

Accepted side shows display the participant's own hand and every hand privately shared with them in a comparison dialog. The server controls visibility; other viewers receive no extra card data. The dialog can be reopened through a compact control and shared cards remain visible at their seats, including packed opponents.

A completed round displays the winner's name, hand result when visible, and amount won in a prominent central banner. Split pots list each payout. Short gold, red and green confetti falls once per displayed completed round and respects reduced-motion preferences. The host's next-deal button remains in the action dock; the participant's hand stays on the table.

## Interaction details

Controls have 44px minimum targets, visible keyboard focus, action-specific disabled states and sufficient text contrast over the felt. Long names truncate with full-name titles. Dialogs return focus to their opener, use the table palette, and keep scrollbars themed. Realtime actions use the existing authenticated response and revision synchronization; no private cards are transmitted through socket events.

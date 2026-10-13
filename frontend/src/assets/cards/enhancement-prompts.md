# Card artwork enhancement

Generated with the built-in image-generation tool on 13 October 2026. The source images remain in this folder; the app uses the enhanced variants. No game rules or card identities are derived from these images.

## Face sheet

Use case: lighting-weather (image restoration only).
Asset type: production playing-card face sprite sheet for a game.
Input image 1 is the EDIT TARGET: a photograph of an uncut Bicycle deck sheet.
Primary request: enhance and restore ALL the existing card faces and both jokers to clean, consistent printed artwork. Remove washed-out colors and uneven photographic lighting. All hearts and diamonds must have the same rich saturated red, all spades and clubs the same deep near-black, including every top and bottom corner rank/suit index. Make the white paper uniformly clean white. Restore vivid red, blue, yellow and black details in the existing court figures and joker artwork, with crisp clean edges and legibility.
CRITICAL INVARIANTS: this is color/contrast/sharpness restoration, not a redesign. Keep the entire source canvas, its 4:5 portrait aspect ratio, outer margins, exact grid cell positions, all original typography, every card rank, every suit, every pip count, every pip location, every court portrait and both corner indices exactly unchanged. Do not rearrange, straighten individual cells, shift the grid, crop the sheet, change the number of symbols, or invent any artwork. Preserve all 52 normal cards and both jokers. Preserve all source sheet labels and registration bars in their existing positions. The result must map onto the existing sprite coordinates without moving any artwork.
Avoid: gray or faded black suits, pink or pale red suits, gradients across ink, highlights, glare, shadows over paper, missing pips, invented pips, altered rank text, clipping, blur, new text, new borders. Render the enhanced sheet as a flat evenly illuminated high-quality scan of THIS exact sheet.

## Card back

Use case: precise-object-edit.
Asset type: enhanced card-back bitmap for a playing-card game.
Input image 1 is the EDIT TARGET and exact design reference: the red Bicycle Rider Back photograph partly overlapped by an ace.
Primary request: isolate and restore ONLY the complete red Bicycle card back as a clean, sharp, flat digital scan. Remove the overlapping ace and reconstruct the obscured part using the symmetry of the original Rider Back design. Keep the two mirrored bicycle riders, ornate floral scrollwork, exact red-and-white pattern and thin rectangular red frame faithful to the reference. Enhance the whole back to consistent rich red and crisp white details.
Composition: ONE upright complete card back, perfectly front-on, no tilt or perspective, filling the canvas edge to edge. Portrait 5:7 aspect ratio. The full canvas IS the flat card face: a small uniform white card border around the centered red pattern, all four corners fully visible. No extra background outside the card, no other cards.
Constraints: preserve the original Bicycle back design, with clean consistent red ink and pure white paper; no new motifs, no faces, no text, no shadows, no glare, no photographic fading, no clipped decorative frame. This is restoration and cleanup of the supplied back.


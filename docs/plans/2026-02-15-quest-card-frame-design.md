# Quest Card Frame Design (2:3, No Distortion)

Date: 2026-02-15  
Status: Validated (Brainstormed with user)

## Scope

Implement a new ornate image background for the detail quest card used by `frontend/src/components/QuestCard.tsx` when opened from `frontend/src/pages/Board.tsx`, with strict no-distortion behavior across mobile/tablet/desktop.

Out of scope for this phase:
- Redesign of compact board cards in `Board.tsx`
- Changes to quest data flow, API contracts, or completion logic

## Confirmed Decisions

1. Use no-distortion rendering for the quest card art.
2. Apply ornate background to detail card first (compact cards later).
3. Standardize the detail card to portrait ratio `2:3`.

## Problem Statement

Current board background and card containers rely on generic background-fit behavior that can crop or stretch a single generated image depending on viewport aspect ratio. The goal is to create a reliable visual system where ornate frame art stays intact and text/actions remain readable and usable.

## UX Goals

1. Maintain artwork fidelity at all breakpoints.
2. Keep quest content inside a predictable “safe writing area.”
3. Preserve current interaction model (modal open/close, complete quest action).
4. Keep mobile behavior clear: one compact card per row on board, full detail in modal.
5. Ensure robust fallback when art assets fail to load.

## Technical Design

### 1. Detail Card Layout Contract

Introduce a frame shell for `QuestCard`:
- Outer container enforces `aspect-ratio: 2 / 3`.
- Background image is centered, non-repeating, and rendered without distortion.
- Content is rendered in an inner safe-area layer positioned via CSS custom properties.
- If content exceeds visual space, modal-level scrolling handles overflow.

Result:
- Visual art stays stable.
- Content layout can evolve independently through safe-area values.

### 2. Modal Sizing Contract (`Board.tsx`)

Keep the selected-quest modal centered and width-constrained:
- Mobile: wide enough for legibility with comfortable margins.
- Desktop: capped maximum width so card doesn’t over-scale.
- Scrolling remains obvious and consistent at modal layer.

### 3. Asset Strategy

Treat frame image as a small asset set:
- `quest-card-frame@1x.webp` (`900x1350`)
- `quest-card-frame@2x.webp` (`1800x2700`)
- Optional PNG fallback only if necessary

Rationale:
- Better sharpness on high-density displays
- Predictable scaling for 2:3 layout
- Smaller payload with WebP

### 4. Safe-Area System

Define CSS variables for the content rectangle:
- `--qc-safe-top`
- `--qc-safe-right`
- `--qc-safe-bottom`
- `--qc-safe-left`

Tune values by breakpoint:
- Mobile: larger padding to avoid frame ornaments
- Tablet/Desktop: moderate padding for better content density

### 5. Resilience and Fallback

Provide non-image fallback style (parchment tone + border) so quest completion remains fully usable if assets fail or are delayed.

## Implementation Steps

1. Add frame asset files under `frontend/src/assets/`.
2. Add quest card frame styles (new module or extend `frontend/src/styles/QuestCard.css`).
3. Refactor `frontend/src/components/QuestCard.tsx` markup into:
   - frame shell
   - safe-area content container
   - existing quest content blocks unchanged in logic
4. Update modal wrapper in `frontend/src/pages/Board.tsx` for ratio-friendly responsive sizing.
5. Add graceful fallback visuals for missing/failed image.
6. Smoke-test all quest variants (standard, bounty, corrupted, upcoming, completed).

## Verification Checklist

1. Mobile portrait:
   - Board shows one compact card per row
   - Detail modal opens with readable, non-distorted 2:3 frame
2. Tablet and desktop:
   - Frame remains non-distorted
   - Modal sizing remains balanced
3. Content stress tests:
   - Very long title
   - Long description
   - Multiple tags
4. State variants:
   - Completed
   - Upcoming
   - Daily bounty
   - Corrupted
5. Failure mode:
   - Image unavailable still yields usable card layout/actions

## Risks and Mitigations

1. Risk: Safe-area padding too tight or too loose across devices.  
   Mitigation: tune breakpoint-specific variables with content stress tests.

2. Risk: Asset filesize affects modal open performance.  
   Mitigation: use WebP, size-appropriate variants, and optional deferred loading.

3. Risk: Decorative frame reduces text readability.  
   Mitigation: enforce contrast-safe text colors and minimum font sizes.

## Phase 2 (Deferred)

Compact card styling polish in `Board.tsx`:
- Keep compact cards lightweight and scan-friendly.
- Add subtle thematic treatment (texture/border accents) without full ornate frame complexity.
- Avoid introducing heavy imagery in the high-density board grid unless performance remains acceptable.

## Success Criteria

1. Detail quest card displays a premium ornate style with zero distortion.
2. Usability is preserved on mobile and desktop.
3. Existing quest interactions remain functionally unchanged.
4. Compact-card improvements are intentionally deferred with a clear follow-up direction.

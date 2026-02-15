# Quest Card 2:3 Frame Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a non-distorting 2:3 ornate frame for the detail quest card modal while preserving existing quest behavior.

**Architecture:** Keep API/data behavior unchanged and isolate changes to presentation layers. `QuestCard` gets a ratio-locked frame shell + safe-area content layer; `Board` modal gets responsive size constraints for stable rendering across mobile/tablet/desktop.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes + component CSS, Vite/Bun.

---

### Task 0: Baseline Stabilization (Pre-Feature)

**Files:**
- Modify: `frontend/src/components/EditQuestModal.tsx`
- Modify: `frontend/src/pages/Board.tsx`
- Verify: `frontend` typecheck

**Step 1: Reproduce baseline failure (RED)**

Run: `bun run typecheck`  
Expected: FAIL with `ParsedSchedule.day` union errors and nullable `token` errors in `Board.tsx`.

**Step 2: Apply minimal type narrowing fixes**

- In `EditQuestModal.tsx`, narrow `parsedSchedule.day` with `"day" in parsedSchedule` before `typeof` checks.
- In `Board.tsx`, guard token use before API calls and render `CreateQuestForm` only when token is non-null.

**Step 3: Verify baseline is green (GREEN)**

Run: `bun run typecheck`  
Expected: PASS.

**Step 4: Record non-blocking pre-existing lint state**

Run: `bun run lint`  
Expected: FAIL with TypeScript parser/config errors across many files (pre-existing, out of scope for quest card feature).

---

### Task 1: Add Frame Asset Contract

**Files:**
- Create: `frontend/src/assets/quest-card-frame@1x.webp`
- Create: `frontend/src/assets/quest-card-frame@2x.webp`
- Optional fallback: `frontend/src/assets/quest-card-frame.png`
- Modify: `frontend/src/components/QuestCard.tsx`

**Step 1: Add temporary failing integration check (RED)**

Run: `bun run build` after wiring imports but before using fallback rules.  
Expected: Potential asset or style integration issues caught at compile/build phase.

**Step 2: Wire frame asset imports in `QuestCard.tsx`**

- Import frame assets.
- Add image fallback strategy (WebP primary; optional PNG fallback).

**Step 3: Verify integration compiles (GREEN)**

Run: `bun run build`  
Expected: PASS.

---

### Task 2: Implement 2:3 Frame Shell + Safe Area

**Files:**
- Modify: `frontend/src/components/QuestCard.tsx`
- Modify: `frontend/src/styles/QuestCard.css` (or add equivalent scoped styles used by `QuestCard.tsx`)

**Step 1: Establish failing UX criterion (RED)**

Manual check in `bun run dev`: open selected quest on mobile width and desktop width.  
Expected (current): visual distortion/cropping risk with generic background behavior.

**Step 2: Implement frame shell and content safe-area layout**

- Add frame wrapper with strict `aspect-ratio: 2 / 3`.
- Add layered background style that does not stretch ornament art.
- Move existing quest content into safe-area container using CSS vars:
  - `--qc-safe-top`
  - `--qc-safe-right`
  - `--qc-safe-bottom`
  - `--qc-safe-left`
- Keep all quest logic and button behavior intact.

**Step 3: Responsive safe-area tuning**

- Add breakpoint-specific safe-area values for mobile/tablet/desktop.
- Confirm title/description/tags/rewards/CTA remain in parchment center area.

**Step 4: Verify behavior (GREEN)**

Run: `bun run typecheck && bun run build`  
Expected: PASS.

---

### Task 3: Modal Constraint Updates in Board

**Files:**
- Modify: `frontend/src/pages/Board.tsx`

**Step 1: Establish failing modal fit criterion (RED)**

Manual check in `bun run dev`: open quest modal at narrow/mobile width and wide desktop.  
Expected (current): modal uses generic max-width not tuned to 2:3 frame.

**Step 2: Update modal sizing constraints**

- Tune modal container width/height constraints to support 2:3 card scaling.
- Preserve close behavior, overlay click-to-dismiss, and scroll usability.

**Step 3: Verify updated fit (GREEN)**

Run: `bun run typecheck && bun run build`  
Expected: PASS.

---

### Task 4: Fallbacks and Edge Cases

**Files:**
- Modify: `frontend/src/components/QuestCard.tsx`
- Modify: `frontend/src/styles/QuestCard.css`

**Step 1: Add fallback visual state**

- Ensure card remains usable with parchment-style fallback if frame asset fails.

**Step 2: Stress-check content scenarios**

Manual checks in modal for:
- Long title
- Long description
- Many tags
- Completed quest
- Upcoming quest
- Daily bounty quest

**Step 3: Verify no regressions**

Run: `bun run typecheck && bun run build`  
Expected: PASS.

---

### Task 5: Final Verification and Commit Hygiene

**Files:**
- Verify only intended files changed

**Step 1: Verification bundle**

Run:
- `bun run typecheck`
- `bun run build`
- `git status --short`

Expected:
- Type/build pass
- Diff limited to planned quest card files/assets (+ any intentional docs updates)

**Step 2: Commit in focused slices**

Suggested commit sequence:
1. `fix(frontend): restore typecheck baseline for Board and EditQuestModal`
2. `feat(frontend): add 2:3 framed quest card shell with safe-area layout`
3. `feat(frontend): tune Board modal constraints for framed detail card`
4. `style(frontend): add frame fallback and responsive polish`


# Frontend Design Overhaul & Asset Pipeline Plan

**Goal:** Implement the new frontend look using your prepared designs while creating a repeatable asset pipeline (generation → cleanup → integration).

## Desired Outcome
- New visual design applied consistently across the MVP-critical screens.
- Controlled asset workflow with naming/versioning standards.
- Fast iteration loop between generated assets and frontend implementation.

## Plan

### 1) Design inventory and scope
- Catalog all designs in `frontend/src/assets` by screen/component.
- Mark MVP-critical screens vs post-MVP polish.
- Define acceptance criteria per screen (layout, typography, spacing, interaction states).

### 2) Asset creation workflow
- Standardize prompt templates for image generation.
- Generate candidate assets with consistent aspect ratios.
- Store source prompts and chosen outputs for traceability.

### 3) Asset cleanup workflow (Photopea)
- Remove artifacts and export production-ready versions.
- Enforce format rules:
  - PNG/WebP for raster art.
  - SVG for simple scalable graphics where possible.
- Define export naming convention and file size budget.

### 4) Frontend integration workflow
- Map assets to components/pages before coding.
- Implement assets via component-level props and theme tokens (avoid hard-coded one-offs).
- Add responsive behavior and fallback states.
- Track visual regressions with before/after screenshots.

### 5) Quality gates
- Accessibility pass: contrast, focus states, reduced motion where applicable.
- Performance pass: optimized image dimensions, compression, lazy-loading strategy.
- Consistency pass: spacing, colors, iconography, and typography.

## Deliverables
- Screen-by-screen implementation checklist.
- Asset naming/versioning guide.
- Integration checklist for accessibility and performance.

## Clarification Questions (tracked sequentially)
1. **Pending:** Which 2–3 screens should be redesigned first for MVP impact (e.g., Board, Quest Detail, Auth)?

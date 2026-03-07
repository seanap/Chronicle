# MPA Refinement Roadmap

## Operating Rule
Each page refinement follows the same loop:

1. Capture the current page as the baseline.
2. Build one narrow candidate variant.
3. Review `A` vs `B` in `/design-review`.
4. Record notes and approve a direction.
5. Implement the approved delta in the live MPA assets.
6. Run adversarial review for regressions, rough edges, and accessibility issues.
7. Apply fixes.
8. Validate with tests and, when useful, refreshed screenshots.

## Review Tooling
- Live review page: `/design-review`
- Variant preview route: `/design-review/preview/<page>?variant=<token>`
- Optional review-only assets:
  - `static/review-variants/<page>/<variant>.css`
  - `static/review-variants/<page>/<variant>.js`
- Capture screenshots directly in-browser when a visual delta needs explicit before/after review.

## Page Order

### 1. View
Why first:
- It is the strongest expression of the Chronicle product identity.
- Small palette and control refinements can materially improve perceived quality.

Protect:
- Heatmap-first storytelling
- Filter buttons and comparative overlays
- Dense but readable summary structure

Refine:
- Orange palette quality so highlights read vivid, not muddy
- Filter/button contrast and hierarchy
- Card spacing and supporting copy tone

### 2. Plan
Why second:
- It is the most repeated workflow and benefits most from interaction polish.

Protect:
- Spreadsheet-like row model
- Immediate metric visibility
- Pace workshop and settings affordances

Refine:
- Data-entry responsiveness
- Row selection clarity
- Action affordances for per-day operations
- Color language for `Low`, `Optimal`, `Risk`

### 3. Build
Why third:
- It already has strong drawer patterns worth preserving and clarifying.

Protect:
- Profile Workshop
- Template Workshop
- Two-mode editing model

Refine:
- Drawer ergonomics
- Visual hierarchy across editor/preview panes
- Dense controls without visual clutter

### 4. Sources
Why fourth:
- It should become simpler and calmer, but its current structure is already functional.

Protect:
- Provider card grouping
- `.env` source-of-truth framing
- OAuth visibility

Refine:
- Credential field rhythm
- Required vs optional emphasis
- Status clarity

### 5. Control
Why fifth:
- It should stay utilitarian, but it needs a cleaner and more intentional tone.

Protect:
- Table-based command list
- Inline status feedback
- Quick-run behavior

Refine:
- Visual treatment of operations and outcomes
- Activity-ID helper patterns
- Color system so alert/orange tones stay bright and purposeful

## Candidate Variant Discipline
- One candidate at a time per page unless the difference is very small and explicit.
- Prefer CSS-only review variants first.
- Only introduce review-only JS when CSS cannot express the interaction.
- Use variant names like `a`, `b`, `filters-tight`, `palette-bright`, `drawer-compact`.

## Approval Questions
- Which option feels cleaner in 3 seconds?
- Which option preserves the page’s main job better?
- Which option makes the important data easier to scan?
- Which option introduces any visual confusion, clutter, or muddiness?
- What should be kept from A even if B wins overall?

## First Concrete Step
Start with `View` using a narrow palette/control pass:
- keep layout intact
- improve orange/highlight quality
- tighten filter treatment
- compare baseline vs one candidate in `/design-review?page=view&variant=a`

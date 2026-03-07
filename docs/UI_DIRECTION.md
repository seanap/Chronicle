# UI Direction

## Current Product Direction
- The multi-page app is the product.
- New UI work should refine the existing MPA page by page using small, reviewable deltas.

## Why This Direction Changed
- The MPA already has the stronger information hierarchy, workflow density, and drawer patterns.
- The SPA work was useful for research, API coverage, cache ideas, and testing discipline, but it did not meet the required visual or experiential quality bar.
- The product should evolve from the MPA because it is the cleaner and more trusted interface today.

## Non-Negotiables
- Do not remove the existing MPA pages.
- Do not copy the SPA visual system into the MPA.
- Do not land broad styling changes without direct A/B review.
- Keep the MPA routes as the primary product routes:
  - `/dashboard`
  - `/plan`
  - `/editor`
  - `/setup`
  - `/control`

## What Can Be Reused From Prior Experiments
- Better cache and local-data strategies where they reduce API churn.
- Improved validation/test discipline.
- More structured command/status patterns.
- Documentation discipline around implementation, review, and validation.
- Narrow workflow ideas that can be adapted into the MPA without importing a parallel shell.

## Review Standard
- Every visual change should be reviewed in the browser before landing.
- Prefer `A` vs `B` candidate comparisons over abstract mock descriptions.
- Use `/design-review` to compare the live MPA page against a review-only variant.

# The accessibility pass

Load this file before starting a critique pass, alongside `anti-slop-rubric.md`. Seven phases, adapted for a design critique running against captured screenshots, DOM, and computed styles rather than a live interactive session. Findings from this pass use the same finding schema and confidence gate as the anti-slop rubric — no phase gets a pass on evidence.

## Phase 1 — Semantic structure and landmarks

One `h1` per page, heading levels that don't skip (no `h2` straight to `h4`), `<nav>` / `<main>` / `<footer>` landmarks present and not duplicated, lists marked up as lists rather than divs with bullets drawn in CSS.

## Phase 2 — Keyboard navigation and focus order

Every interactive element reachable by `Tab` in an order that matches the visual flow. Nothing keyboard-only-inaccessible (a hover-only menu, a click-only close button). No focus trap outside an intentional modal, and the modal's trap actually releases on close.

## Phase 3 — Focus visibility

A visible, custom-designed focus state on every interactive element — never the default browser outline suppressed with `outline: none` and nothing put in its place. This doubles as a surface-tell check: a focus state that's just a colour change with no shape or offset reads as an afterthought.

## Phase 4 — Colour contrast and non-colour signaling

Text contrast at or above the brief's stated accessibility floor (WCAG 2.2 AA by default — 4.5:1 body text, 3:1 large text and UI components). Anything that communicates state by colour alone (an error field, a selected tab) also carries a second signal — an icon, a label, a pattern.

## Phase 5 — Forms and error handling

Every input has a programmatically associated label, not just adjacent placeholder text. Errors are announced in text near the field, not only as a colour change on the border. Required fields are marked in a way a screen reader exposes, not only visually.

## Phase 6 — Screen reader labels and ARIA

Icon-only buttons have an accessible name. Images have alt text that describes function where the image is meaningful, and are marked decorative (`alt=""`) where they aren't. ARIA is used to fill a real gap, not sprinkled on elements that already have correct semantics — redundant or contradictory ARIA is itself a finding.

## Phase 7 — Motion and reduced-motion compliance

`prefers-reduced-motion` is honored by swapping transforms for opacity, per `/design-motion`'s spec — never by leaving all motion running. Nothing flashes more than three times per second. Autoplaying content with motion or audio has a visible pause control.

## Severity

Use the same Blocker / High / Medium / Nitpick scale as the anti-slop rubric. A keyboard trap or a missing form label is a Blocker. A weak-but-passing contrast ratio close to the floor is usually a Medium. Missing landmark structure on an otherwise-navigable page is typically a High.

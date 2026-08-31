# Design checklist

Dispatched on a frontend diff only when the sprint spec marks `design:
required`. Checks that the diff actually implements the chosen design
direction and tokens — not a taste critique of the direction itself, which
is `design-critic`'s job in `/design-build`, against screenshots, not a diff.

- Every colour, radius, shadow, spacing, and easing value in the diff:
  sourced from `docs/design/tokens.css`, or invented inline? An invented
  value is a finding regardless of how close it looks to an existing token.
- Does the diff match the chosen direction's named signature element and
  avoid its named anti-reference, or has it drifted toward a forbidden
  reflex (default UI sans as display type, uniform large border-radius,
  purple-to-blue gradient, centered-hero-plus-icon-grid) over the course of
  implementation?
- Motion: does any new transition/animation match `docs/design/motion.md`'s
  spec, or does it fall back to a generic `fade-in-up`/`ease` default the
  spec explicitly rejected?
- Reduced-motion variant present and correct for every new animated element,
  not just the primary one.
- Responsive behavior at the profile's required viewport widths — does
  anything overflow, collapse, or become unreachable at a width the design
  was supposed to support?
- Accessibility regressions introduced by the diff specifically: lost focus
  order, a control that's now mouse-only, contrast that dropped below the
  system's floor.

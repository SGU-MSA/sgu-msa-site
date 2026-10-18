---
name: motion-system-orchestration
description: Defines the project's motion language and interaction feedback, covering when something should move, duration and easing tokens, enter and exit patterns, stagger limits, page transitions, hover, press, focus, toggle, success and error feedback, and how reduced motion is honored across the system. Use when deciding whether and how UI should animate, adding hover or press states, tuning timing, or reviewing animations that feel inconsistent, slow or gratuitous. Not for Motion library APIs, CSS-versus-library choice or spring generation (use motion), frame-rate jank (use rendering-animation-performance) or the reduced-motion accessibility requirements themselves (use sensory-motion-accessibility).
---

# Motion system and interaction feedback

Motion explains a change of state, a relationship, or feedback to an action. Decoration alone is not a reason.

## In this repo

- Tokens: `--transition-fast` (160 ms) and `--transition-standard` (260 ms) in `src/styles/tokens.css`; `--motion-reveal` (480 ms entrance) in the same file. Use them; add a token rather than a new literal duration.
- Reduced motion: `src/app/globals.css` neutralizes animation under `prefers-reduced-motion: reduce`, and design CSS gates entrance motion behind `prefers-reduced-motion: no-preference`. Follow that pattern: decorative motion is opt-in.
- Motion (`motion`, `motion/react`) is installed and wired in `src/shared/layout/MotionRoot.tsx` (`LazyMotion` with `domAnimation`, `MotionConfig reducedMotion="user"`) and used by `BlurFade`, the popover, `SortableList`, `UrgentNoticeRotator` and `TasbihThreadView`. CSS first, Motion when CSS cannot do it (the motion skill's CSS-or-Motion guide); a different animation library is a dependency decision.
- Tone: a mosque and student community site. Default to calm fades and short slides, no overshoot. The motion personality is a design decision; show options (a short screen recording or live demo) and recommend.

## Timing and easing

| Element | Duration |
| --- | --- |
| Press, toggle, small hover | 100–160 ms |
| Menus, popovers, small panels | 160–260 ms |
| Dialogs, drawers, large surfaces | 250–400 ms (max ~500 ms) |

- Exits run faster than entrances (about two-thirds).
- Ease-out for entrances, ease-in for exits, ease-in-out for elements moving on screen. No `linear` for UI movement.
- Stagger lists by 30–60 ms; the whole sequence finishes within ~400 ms. Do not stagger more than about 6 items.
- Never block input: the user can click or type during any transition.
- Animate `transform` and `opacity` (see rendering-animation-performance). No `transition: all`.

## Interaction feedback

- Every interactive element has visible hover (pointer devices), `:focus-visible`, active/pressed, disabled and, where async, loading states.
- Press feedback responds within 100 ms; hover is never the only signal.
- Disabled looks disabled by more than opacity and cannot be activated.
- Success confirmation is brief and does not block the next task.
- Error feedback is a message plus an icon. An optional shake stays small (2–4 px, at most 3 cycles) and is removed under reduced motion.
- Focus rings are restyled, never removed (contrast in color-systems-contrast-intelligence).

## Page and route transitions

- Default: none, or a quick fade on the content region. Navigation must never wait for an animation.
- Any shared-element or view transition is a design decision and needs a reduced-motion path.

## Review checklist

- [ ] Each animation has a stated purpose
- [ ] Durations and easings come from tokens
- [ ] Exits faster than entrances; nothing blocks input
- [ ] Full state coverage on interactive elements
- [ ] Verified with reduced motion turned on

## Failure modes

- Every element animating differently ("popcorn")
- Entrance reveals that delay reading
- Long stagger waves
- Bouncy springs on serious content
- Hover-only feedback on touch devices

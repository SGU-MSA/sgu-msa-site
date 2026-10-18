---
name: state-input-flow-architecture
description: Designs every non-happy-path UI state and form flow, covering loading, skeleton, empty, error, partial, stale and success states, validation timing, error messages, multi-step flows, pending submissions, duplicate-submit prevention, destructive confirmations and undo. Use when building async views, loading.tsx or Suspense fallbacks, public forms, or admin dashboard editors used by non-technical board members, or when asking what the user sees when something fails. Not for error-boundary placement and browser fallbacks (use cross-browser-error-resilience), form markup and labels (use semantic-document-architecture), or image and font loading speed (use core-web-vitals-optimization).
---

# State and input flow architecture

Design the loading, empty, error and success states with the same care as the main state. A board member must be able to finish every admin task without a developer (project principle 1).

## In this repo

- Admin editors live in `src/features/admin`. Server actions in `actions.ts` validate with zod and return `{ error, notice }` (`EditorState`); client forms use React 19 `useActionState` / `useFormStatus`. Reuse that shape; do not invent a second form-state pattern.
- Validate on the server with the same zod schema the data layer uses (`src/lib/community/schema.ts`, `src/lib/content/schemas.ts`). Client checks are a convenience, never the gate (principle 5: shapes are single-sourced).
- Route loading UI is `loading.tsx`; slower independent sections get their own `<Suspense>` fallback.

## Board-facing forms

- Plain-language labels and help text. No jargon (slug, UUID, RLS, revalidate).
- After saving, say what changed and where it appears, with a "View on site" link when there is a public page.
- Destructive actions (delete, unpublish) confirm using the item's name. Prefer unpublish/restore or undo over permanent delete where the data model allows.
- Never lose input: on a validation or save error, keep every field value.
- Errors say what failed and what to do next. Never show raw error codes or stack traces, and never ask the board to "contact a developer" for something the dashboard should handle.
- Uploads: state accepted types and size up front, show a preview and progress, and give a specific error.
- Whether a field is required, and what its help text says, are product decisions. Propose; let the user choose.

## Validation timing

- Do not validate on the first keystroke.
- Validate format on blur; after a field is marked invalid, re-validate on change so it clears immediately.
- Validate everything on submit; move focus to the first invalid field or an error summary.
- Put the message next to the field and link it with `aria-describedby` (see semantic-document-architecture).

## Loading and perceived speed

- Under ~300 ms: show nothing. Longer: a skeleton shaped like the real content, or a spinner inside the triggering control.
- Server-rendered, above-the-fold content never shows a skeleton.
- Every loading state has an end: after ~10 s, show an error with a retry, not endless shimmer.
- Reveal in content priority order (heading, then image, then details); never hold content the user can already act on.
- Shimmer is subtle and stops under reduced motion (see sensory-motion-accessibility).

## Submission

- Disable the submit control while pending and change its label ("Saving…"). Duplicate submits are a bug.
- Optimistic UI only for reversible actions, and always with a visible rollback if the server rejects.
- Multi-step flows keep earlier answers when going back.

## State map template

```
view:  loading → ready | empty | partial (one source failed) | error (retry → loading)
ready: stale (background refresh) → ready
form:  pristine → dirty → submitting → saved (notice) | rejected (field errors, values kept)
```

## Checklist

- [ ] Every async path has loading, success and error states
- [ ] Empty states explain why and offer the next action
- [ ] Errors are human, specific and actionable
- [ ] Input survives every error path
- [ ] Pending state blocks duplicate submits
- [ ] Destructive actions confirm by name and have a recovery path

## Failure modes

- Blank screen until data arrives, or a skeleton that flickers for 100 ms
- "Something went wrong" with no next step
- "No data" empty state with no action
- Form cleared after a failed save
- Optimistic update that silently fails on the server

---
status: approved
mode: light
---

# Remove the "Archive" photo label and the "Old photo" tick

Ticket: SGU-MSA/sgu-msa-site-private-history#128 follow-up (filed under #109). Base: `origin/main`. PR target: `main` in `SGU-MSA/sgu-msa-site`.

## Capability

Photos are shown as the board chose them, with no automatic or ticked "Archive" label anywhere on the public site, and no "Old photo" setting in the dashboard.

## Requested Behavior

1. No public page shows "Archive", "Archive photo" or " · Archive" for any photo or resource. Today this comes from `ArchiveTag` (`src/shared/ui/Meta.tsx`, used at `src/features/resources/ResourceExplorer.tsx:127`) and `src/features/home/FeatureRow.tsx:52`, styled by `.archive-tag` in `src/styles/design.css`.
2. The dashboard photo editor no longer shows the "Old photo (shows “Archive photo” and its year)" tick (`src/features/admin/pages/PageTextEditor.tsx:589-598`, label `oldPhoto` in `src/lib/system-text.ts:99`).
3. The image data shape no longer carries `historical` (and its companion `year`, if it exists only for this label): remove it from the zod image schema (`src/lib/content/schemas.ts:102`), the save normalizer (`src/lib/content/page-fields.ts:1636`), defaults (`documents.ts`, `PageTextEditor.tsx:125,538,566`), the call sites that force `historical: false` (season, merch, about, community feed, event entry) and the YAML starter text in `content/*.yaml`. Stored page documents that still contain `historical` must keep loading: confirm the object schema strips unknown keys (do not make it strict); add a unit test that a stored image with `historical: true` parses and renders with no label.
4. Leave unrelated "historical" meanings alone (e.g. the status enum at `src/lib/content/schemas.ts:315`, docs/archive provenance notes, migrations). Do not edit the baseline migrations `supabase/migrations/202610150001`–`202610150004`; no new migration is needed because stored JSON is tolerated and dropped on the next save.

## Existing System Evidence

Files above; `grep -rn "historical\|ArchiveTag\|oldPhoto\|archive-tag" src content tests` lists every use. Tests: `tests/community-feed.test.ts`, `tests/term-export-migration.test.ts` reference the field. Origin: inherited from the original prototype's asset manifest (`docs/archive/notes/ASSET_MANIFEST.md`), never a board decision.

## Owner

`src/lib/content/schemas.ts` owns the image shape; `src/shared/ui/Meta.tsx` owned the tag; the admin page editor owns the tick.

## Source of Truth

The zod image schema. One removal there, everything else follows from the type checker.

## Product Decisions Required

None outstanding (admin tick removal to be confirmed by the maintainer on the PR before merge).

## Decisions

- D-1 (maintainer, 2026-10-18): remove the archive label from every user-facing page; the board decides what photos to use.
- D-2 (planner, pending maintainer confirmation on the PR): also remove the dashboard tick, because it would no longer do anything.

## Board Self-Sufficiency Check

Board keeps full control: they choose and replace photos. One fewer setting to understand.

## Implementation Constraints

- Allowed: the files named above, their stories/tests, `src/styles/design.css` (remove `.archive-tag` only), `content/*.yaml` (remove the field only), `docs/release-checklist.md` (top of **Latest changes**; no settings change), this contract copied to `docs/contracts/remove-archive-label.md`.
- If `PocBadge` in `Meta.tsx` is unused after the change, leave it (out of scope) unless it is also unused today — then note it, don't delete.
- Do not add dependencies, do not edit baseline migrations, do not change any other photo behaviour or page layout. Branch `chore/remove-archive-label` from `origin/main`.
- Stop with PLAN MISMATCH if removing the field breaks the term export, a migration test or anything that reads stored JSON strictly.

## Test Strategy

`npm run check`; `npm run test:smoke`; `npm run build-storybook`. Unit test for tolerant parsing of stored `historical`. Grep proves no "Archive" text remains in public rendering code.

## Acceptance Criteria

- `/resources` and `/` render no archive label for any item, including the seeded Jumu’ah resource.
- Dashboard photo editor shows no old-photo tick; saving a page drops any stored `historical` key.
- Existing stored documents load without errors.
- All checks pass.

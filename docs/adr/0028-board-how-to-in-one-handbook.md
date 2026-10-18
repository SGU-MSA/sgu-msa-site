# 0028. The board's how-to lives in one handbook; picture help removed

- Status: Accepted
- Date: 2026-10-06
- Supersedes: layer 3 ("Picture help") of [0008](0008-layered-admin-onboarding.md)

## Context

Board steps were written twice: as picture cards on the dashboard's Help page (ADR 0008, layer 3) and in the board's Word handbook (final plan B). Two copies drift apart, and the board cannot edit the Help page without a developer. The user's rule is one place per topic, and an editable file beats text on the website.

## Decision

- `handover/SGU-MSA-Website-Handbook.docx` is the only place for board how-to, accounts and emergency steps. The board owns and edits it.
- The dashboard's Help page (`/admin/help`) only says where the handbook is (the president keeps it) and lists the "Show me how" tours.
- The picture cards, their screenshots (`public/admin-help/`) and the capture script are removed.
- Layers 1 (simple forms with hints) and 2 (guided tours) of ADR 0008 stay unchanged.

## Consequences

- A PR that changes a dashboard screen lists the new board steps under "Handbook notes" in its body, and the handbook is updated from them.
- Tours still change in the same PR as their screens; their texts are approved by the user.
- No screenshots to re-take, and no pictures to keep under a size budget.

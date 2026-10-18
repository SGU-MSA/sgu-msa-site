---
name: managing-project-work
description: Keeps SGU MSA work tracked in GitHub issues, milestones and the organization Project. Use before starting a substantive task, when scope or blockers change, and before reporting completion or merging a PR. Reuse existing tickets; do not create tickets for ordinary questions or post duplicate updates after every message. Does not approve or implement unread website/game plans.
---

# Managing project work

Use GitHub as the execution tracker. Keep updates short and useful.

## Before work

1. Use `scripts/agents/github.sh` for GitHub CLI operations. Keep authentication local and never print tokens or copy credentials into Git.
2. Find the existing issue/epic in `SGU-MSA/sgu-msa-site-private-history` before creating another. Link the task to that private tracker issue and explain the scope to the user. Code pull requests belong in the clean public repository `SGU-MSA/sgu-msa-site`.
3. Add the issue to the existing SGU MSA Delivery Project in the private-history repository when available. Reuse its Status field: backlog/planned, in progress, blocked or done as appropriate. If owner permissions are missing, record the exact blocker and continue independent work.
4. Milestones group deliverables; parent issues group related work. Use an iteration/sprint only when a cadence and dates have been agreed. Do not invent deadlines or duplicate a roadmap in issues.
5. Unread/unapproved website and game plans remain backlog. Configuration and project organization authorization does not authorize implementing those plans.

## During work

- Update the ticket when scope, a decision, a blocker or a meaningful result changes. Keep the user informed; do not append a comment after every tool call or chat reply.
- Record product decisions in their owning contract/ADR, then link them. Do not copy competing versions into issue bodies.
- Keep credentials, cookie data, production endpoints and personal data out of tickets, logs and PRs.

## Before finishing

1. Record the concrete result, relevant checks, remaining work and links on the issue. Distinguish configured, authenticated and successfully tested.
2. Review the PR against its contract with the engineering review skill. Use a separate capable reviewer for implemented code, then leave the passing PR for maintainer review/merge (ADR 0032). The latest human-merge instruction supersedes earlier automatic integration-merge authorization.
3. Close unneeded PRs and delete their source branches only after preserving any useful assessment/planning notes and confirming the branch is not used by another active task. Do not discard the current worktree or unrelated local work.
4. Keep a ticket open when required work remains. Close completed execution tickets and move their Project status accordingly; reference the merged PR.
5. Give the user a brief result and next step. Point to plans awaiting their review; do not start them.

## Skills and hooks

Both clients read this skill through their shared agent SOP. Invoke it at task boundaries and meaningful changes, not after every message. No GitHub-writing hook is required. If a local reminder hook is added later, reuse one small script behind client adapters and test both runtimes; keep network mutations in the agent's explicit workflow.

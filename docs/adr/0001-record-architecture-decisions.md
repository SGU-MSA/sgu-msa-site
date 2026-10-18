# 0001. Record architecture decisions

- Status: Accepted
- Date: 2026-10-02

## Context

The site will be maintained by changing developers, AI agents and board members over many terms. Without a written record, people re-open settled questions or undo decisions they did not know about.

## Decision

- Lasting, cross-cutting decisions (affecting several features, hard to reverse, or a policy) are recorded as an ADR in `docs/adr/NNNN-slug.md`, MADR-style: Status, Date, Context, Decision, Consequences. Keep each short.
- Choices that only affect one feature go in the **Decisions** section of that feature's contract in `docs/contracts/` instead. If a contract decision turns out to be cross-cutting, promote it to an ADR.
- Allowed statuses: `Proposed`, `Accepted`, `Deprecated`, `Superseded by NNNN`.
- Once accepted, an ADR is immutable. Only its status line and typos may change. To change a decision, write a new ADR and mark the old one `Superseded by NNNN` with a link.
- Every ADR is listed in [the index](README.md). A test checks the index, statuses and superseded links.
- The person who decides is the user/board, not an agent ([ADR 0002](0002-product-principles.md)). The ADR records who chose and the options considered.

## Consequences

- Reviewers can ask "which ADR or contract covers this?" for any non-obvious change.
- Numbers are never reused; superseded ADRs stay in place as history.

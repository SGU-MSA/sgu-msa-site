# SGU MSA website

The website and private board dashboard for the SGU Muslim Students Association and its musallah. The public code repository is `SGU-MSA/sgu-msa-site`; private historical issues and Git history remain in `SGU-MSA/sgu-msa-site-private-history`. Do not copy old commits or private-history files into the public repository. `main` is the live code: one Next.js application in the Quiet Paper design (light and dark, [ADR 0018](docs/adr/0018-design-direction-quiet-paper.md)), Supabase for content, sign-in and files, and Vercel hosting. Branding is not yet approved.

Our motto is **board self-sufficiency**: anything a board member may want to change should be possible from the dashboard, without a developer ([ADR 0002](docs/adr/0002-product-principles.md)).

## Quick start

Requires Node.js 22+ and npm. In this folder:

```sh
npm ci
npm run demo     # http://localhost:3000, fictional sample data, editable; resets on restart
npm run storybook  # the shared components in light and dark, http://localhost:6006
npm run dev      # normal app on http://localhost:3000; needs .env.local (copy .env.example)
npm run check    # lint, typecheck, tests, formatting; CI runs the same on every PR
```

No account or backend is needed for `npm run demo` (it reads `SITE_URL` from `.env.local`; copy `.env.example`) or `npm run storybook`. The [developer guide](docs/guides/developer.md) covers configuration, builds and browser tests.

## Where to read

| You are | Start here |
| --- | --- |
| A board member editing the site | The [Board Handbook](handover/SGU-MSA-Website-Handbook.docx) (Word file; see the [board guide](docs/guides/board.md)) |
| The site owner (accounts, hosting, admins, backups) | [Owner setup](docs/guides/owner-setup.md) |
| A developer | [Developer guide](docs/guides/developer.md) |
| An AI coding agent | [AGENTS.md](AGENTS.md) |
| Anyone asking "why is it like this?" | [Decision records (ADRs)](docs/adr/README.md) |
| Anyone asking "how does it fit together?" | [Architecture diagrams](docs/architecture.md) |
| Anyone asking "what is next?" | [Roadmap](docs/roadmap.md) |

Topic guides: [Prayer times](docs/guides/prayer-times.md), [Photography](docs/guides/photography.md). What to test before going live: [Release checklist](docs/release-checklist.md). Provider notes: [Go2Pay](docs/proposals/go2pay.md). The archived notes under `docs/archive/notes` are retained for decision history; obsolete source briefs and concept images remain only in the private-history repository.

## License and media

Project-authored code is licensed under MIT for this release. The Unlicense grant for earlier releases remains available in [LICENSE-UNLICENSE-ORIGINAL.txt](LICENSE-UNLICENSE-ORIGINAL.txt). Neither license grants rights to SGU MSA branding, photographs, other media, or third-party works. See [LICENSE](LICENSE) and each item’s separate terms.

## Repository layout

```text
src/              Routes, UI, providers and domain rules
content/          Editorial YAML that is not yet editable in the dashboard
public/           Files served to visitors
supabase/         Database migrations and local backend configuration
tests/            Unit and browser tests
scripts/          Development and verification commands
docs/guides/      Current guides for board, owner and developers
docs/adr/         Architecture and product decision records
docs/proposals/   Proposals awaiting decisions
docs/archive/     Decision-linked historical notes; raw source material stays private
```

Payments are not live. The only planned payment channel is Go2Pay ([ADR 0005](docs/adr/0005-payments-channel-policy.md)).

# 0030. Project-local MCP additions, generated active config outside Git

- Status: Accepted
- Date: 2026-10-14
- Partially supersedes: [ADR 0003](0003-shared-agent-configuration.md), only the tracked active Codex file and the absence of local additions.

## Context

The user explicitly requested shared MCP setup in Git and production connections local to this project only, with production read/write capability. Codex natively loads `.codex/config.toml` for trusted projects, but does not document a separate project `config.local.toml` include. Keeping the active file tracked would risk committing private additions or require special launch commands.

## Decision

- `.mcp.json` remains the tracked source of shared server definitions. Shared Supabase remains staging and read-only.
- Optional `.mcp.local.json` is ignored and adds server names without replacing shared definitions. Actual production endpoints and any private configuration remain here, never in committed files.
- The existing generator combines these sources into Git-ignored `.codex/config.toml`. Native Codex clients automatically load that project configuration. `npm ci` runs generation through `prepare`; maintainers rerun `npm run agents:sync` after changing sources.
- Generated skill dependencies continue to use shared definitions only. No private connection enters tracked metadata.
- Generation refuses tracked or unignored private paths and restricts local file permissions. OAuth credentials stay in the client's credential store; they are never copied into repository configuration.
- Claude private connections use its project-keyed `--scope local` registration. Production is never registered in user-level Codex configuration.
- Vercel and local additions keep tool approval prompts. Production capability alone grants no ongoing permission to change production data or schema. Connection tests and production operations require explicit user authorization.

## Consequences

Fresh clones generate the active Codex file during installation. Shared configuration remains reproducible from Git; local production definitions and OAuth grants do not transfer to other developers. Authentication and server registration are distinct: a successful login still requires an actual tool request to establish working access.

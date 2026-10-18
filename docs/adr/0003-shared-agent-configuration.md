# 0003. Shared agent configuration for Claude Code and Codex

- Status: Accepted
- Date: 2026-10-02

## Context

Maintainers may use Claude Code or Codex. Duplicated instructions, skills or MCP settings drift apart and confuse both tools.

## Decision

- `AGENTS.md` is the canonical agent rulebook. `CLAUDE.md` only imports it (`@AGENTS.md`), because Codex reads AGENTS.md directly and has no import syntax.
- Skills live in one real folder, `.claude/skills/<name>/SKILL.md`. `.codex/skills` is a relative symlink to it so Codex reads the same skills (verified on Codex 0.153; OpenAI's docs name `.agents/skills` as the current location, so if a future Codex stops reading `.codex/skills`, add the same symlink at `.agents/skills`).
- MCP servers are defined once in `.mcp.json`. The Codex `.codex/config.toml` is generated from it with `npm run agents:sync` and never edited by hand.
- Skill frontmatter uses only portable fields. Skills that depend on an MCP server name the exact tools, give a fallback, and declare the dependency for both tools.
- Size budgets keep context cheap: AGENTS.md at most 150 lines; each SKILL.md at most 200 lines (vendored third-party skills at most 500); each skill reference file at most 150 lines, with a table of contents above 100. Tests enforce them.
- No absolute or personal paths, and no secrets, in any committed agent file.

## Consequences

- Windows users need symlink support (WSL, or `core.symlinks`), see the developer guide.
- Adding an MCP server is one edit plus one command.
- Tool-specific features (for example Claude Design) are documented as such, with a fallback for the other tool.

---
status: approved
issue: 122
---
# Project MCP configuration

## Capability
Reliable shared MCP setup with additional project-local connections and persisted OAuth authentication.

## Requested Behavior
The user requires every repository MCP to be configured and tested. Shared configuration belongs in Git. Production connections belong only to this project and must never enter Git. Production Supabase must expose read/write capability; testing must not change business data or schema. No paid services or deployments are authorized by this task.

## Existing System Evidence
`.mcp.json` owns nine shared server definitions. `scripts/agents/sync-mcp.mjs` generates a tracked `.codex/config.toml` and skill metadata. `tests/agent-config.test.ts` checks drift, safety, portability and the skills symlink. Codex has no documented project-local config.local.toml include. Claude already has project-scoped local Supabase write registrations. Vercel get_project succeeds when teamId/slug are omitted. Supabase search_docs succeeds but execute_sql times out; staging DNS fails resolution. Production ref comes from existing local registration and is never copied into this contract.

## Owner
`scripts/agents/sync-mcp.mjs` continues to own Codex configuration generation. `.mcp.json` continues to own shared server definitions.

## Source of Truth
Shared definitions: tracked `.mcp.json`. Optional local additions: ignored `.mcp.local.json`. Generated Codex active configuration: ignored `.codex/config.toml`. OAuth credentials remain in the client credential store, never in either JSON source. Skill metadata is generated exclusively from shared definitions.

## Reuse and Duplication Analysis
Extend the existing generator instead of adding a competing config system or launch wrapper. The active Codex file is derived, not a second source. Claude uses its supported project-local registrations for local additions. Never copy production definitions into skill dependencies.

## New Abstractions
A small validated merge of shared definitions with local additions. Local definitions may add server names but cannot replace shared names. No application abstractions change.

## Product Decisions Required
None. This changes developer tooling only; requested configuration boundaries and production capability are explicit user decisions.

## Decisions
User on 2026-10-14 explicitly requested all shared MCP configuration in Git, production connections project-local only, and production read/write capability. This supersedes the narrower staging-only restriction for setup and harmless production connection verification only. Production changes still require explicit authorization. Generating the active Codex config outside Git allows native Codex clients to load local additions automatically without tracking production settings.

## Board Self-Sufficiency Check
No dashboard or board workflow changes. This is maintainer tooling only and requires no board handbook edit.

## Design
Track only shared sources, generators and documentation. Ignore local JSON and generated active Codex TOML. Run generator during npm prepare and explicit agents:sync. Local files are permission 0600. Generation must never print contents or secret values. Existing skill metadata remains unchanged unless shared configuration changes.

## Public Contract
`npm run agents:sync` and `npm run agents:check` retain their meanings, now including local additions for the active local Codex config. `npm ci` prepares shared config on a fresh clone. `.mcp.local.json` accepts the same mcpServers shape but additions only. `.mcp.json` remains sufficient to reproduce all shared connections.

## Private Implementation
Export a validated merge function in the existing generator. Validate both source objects and disallow duplicate names. Generate Codex from merged definitions and skill metadata from shared definitions only. Sanitize local-file parse errors; never include JSON source excerpts. Check that local JSON and active TOML are ignored and untracked before writing local additions. Update ignore rules, preparation script and setup guidance. Remove active TOML from tracking, without removing the local generated file.

## Data and State Flow
Tracked shared JSON plus ignored local JSON flow through the existing generator into ignored project Codex config. Shared JSON alone flows into tracked skill metadata. Codex/Claude own OAuth persistence separately. No server definition is added to global Codex configuration.

## Failure Modes
Malformed local JSON, invalid server shape, duplicate names, unsupported transport, and tracking of local files fail safely before generation. A timed-out database call is not reported as authenticated data access. Missing runtime targets are reported separately from disconnected MCP servers. Local additions must not affect another repository.

## Compatibility and Migration
Supersede ADR 0003 only for tracking the generated Codex file and add local additions; keep its single-source shared configuration, skills and portability decisions. Fresh installs generate active config via prepare. Existing setups run agents:sync once. Claude local registrations remain project-scoped and do not enter shared JSON.

## Parallel Work and Merge Order
Single implementation owner, no parallel edits. Branch from origin/integration. Configuration PR targets integration and does not merge or deploy the application.

## Work Packages
1. Add local config merge, ignore rules, fresh-install generation and regression checks.
2. Document setup and production boundaries; update ADR and Unreleased.
3. Configure this checkout locally, authenticate production if needed, test each server and cross-project exclusion.
4. Run npm run check, review the diff, commit only shared changes and open a focused PR.

## Implementation Constraints
Never read .env files or print credentials. Never add production URL/ref/token to tracked files. Never apply migrations, change production business data, enable paid services or trigger deployment. Retain shared staging project scoping; staging is read/write under the explicit user amendment below. Avoid app source changes. Check Git index for local files before commit. Do not claim write execution was tested unless a harmless reversible test actually succeeded; report capability separately from execution.

## Worker Escalation Conditions
If production project identity cannot be verified, pause that connection test and request only the missing identity/authentication. If native configuration cannot keep local additions outside Git, stop and revise the tooling contract before implementing a workaround.

## Test Strategy
Unit tests cover local merge rejection, invalid source shapes, local-only Git exclusion and shared skill-metadata isolation. Run npm run check. Test actual tool calls for all nine shared servers and production registration with safe metadata queries. Start a sample-data Next.js dev server for runtime verification. Verify OAuth in a fresh client process and confirm production registration absent outside repository. Record failures truthfully in issue 122.

## Acceptance Criteria
All shared definitions, generator changes and maintainer instructions are committed in a PR against integration. Production definitions remain ignored and project-local. Every configured server has an actual request result recorded. Successful connection, missing runtime and upstream failure are distinguished. No production business data/schema or paid service changes occur.

## Open Risks or Escalations
Staging project may be paused or otherwise unavailable; authenticated dashboard verification is pending. A newly configured production endpoint may require one OAuth consent. Existing live session may require MCP reload to discover newly added tools; local fresh-client tests must establish configuration correctness independently.

## Amendment: agent-agnostic read/write staging (2026-10-14)

User decision: staging must be read/write, and shared configuration must work for both Claude and Codex. This supersedes the earlier read-only staging choice in this contract and ADR 0030. Keep production project-local and ignored.

Additional work packages: move canonical skills to `.agents/skills`, retain relative `.claude/skills` and `.codex/skills` compatibility links, replace Maestro’s Claude-specific project variable with Git root discovery, regenerate shared skill metadata, and update current instructions/tests. Extend the existing generator with explicit `--claude-local` registration using Claude’s native local scope, driven by `.mcp.local.json`; matching definitions are idempotent and ordinary preparation performs no Claude registration. Inject a fake CLI runner in tests so no test changes real account configuration. Do not create a second canonical server/skill source. Verify native discovery in both clients, metadata proving staging write capability, and production exclusion outside the project. Preserve old ADRs and historical contracts. No schema migration or production write is part of this amendment.

## Amendment: persistent approved-site browser and integration merges (2026-10-14)

The user now authorizes persistent browser logins for GitHub, Supabase and Vercel only, shared by Claude and Codex. This replaces the previous temporary-browser preference. Keep the dedicated browser profile and any GitHub owner CLI credentials under ignored `.agents/local/`, specific to this repository. Browser settings should retain cookies for those three sites, treat other cookies as session-only, and disable password saving; use isolated contexts for other websites. A small launcher owned by `scripts/agents` selects the project profile and reuses its running browser endpoint. Do not read/export cookie values into model output or commit credentials. Do not use a personal browser profile.

The user authorizes reviewing and merging necessary PRs into integration and closing unneeded work. This does not authorize merging the production release or implementing unread website/game plans. Record work in existing tickets/projects/milestones, add one shared project-management skill invoked at task boundaries, and document the current Claude/Codex hooks findings. No GitHub-writing after-every-message hook is required. If owner access is needed, authenticate through a project-scoped CLI config without changing the user's global login.

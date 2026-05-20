---
name: agent-ecosystem-architect
description: Use this skill when designing, auditing, or extending an agent ecosystem: agent roles, skills, MCP servers, tool boundaries, memory conventions, repo automation, handoff protocols, safety checks, and multi-agent workflows. Trigger when the user asks how agents should collaborate, what skills to add, how to wire MCP tools, or how to structure agent operating procedures.
---

# Agent Ecosystem Architect

Design agent systems as operating environments, not as a pile of prompts.

A good agent ecosystem has clear boundaries:

```txt
human intent -> agent role -> skill selection -> tool access -> verification -> handoff
```

## Phase 1: Map the ecosystem

Inventory the current system before adding new parts:

- Existing agents, skills, prompts, and operating rules.
- Available tools and their permissions.
- MCP servers and local dependencies.
- Repositories, branches, worktrees, and deployment targets.
- Secret handling and credential exposure risks.
- Generated artifacts and build outputs.
- Human approval points.

Separate three layers:

```txt
Policy: what agents are allowed to do
Capability: what tools and servers make possible
Workflow: when and how those abilities are used
```

## Phase 2: Design roles and boundaries

For each agent or skill, define:

- Purpose: the job it exists to do.
- Trigger: when it should be used.
- Inputs: what context it needs.
- Tools: what it may call.
- Outputs: what it should produce.
- Stop conditions: when it must ask the user.
- Verification: how its work is checked.

Prefer small, named responsibilities over broad universal agents.

Use this role matrix:

```txt
Role | Trigger | Allowed tools | Forbidden actions | Output | Verification
```

## Phase 3: Wire tools safely

Treat MCP servers and tool integrations as capability grants.

Before adding a server, check:

- Whether the local runtime exists.
- Whether the server requires Docker, Node, Python, or another dependency.
- Where credentials are stored.
- Whether tokens are scoped narrowly enough.
- Whether tool calls can mutate external systems.
- Whether logs could expose secrets.

For a GitHub MCP server using Docker, the configuration shape is:

```json
{
  "mcpServers": {
    "github": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN",
        "ghcr.io/github/github-mcp-server"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>"
      }
    }
  }
}
```

Use this as configuration guidance only unless Docker is installed and the user has provided an intentionally scoped token through a secure channel.

## Architecture checklist

Review whether the ecosystem has:

- Clear skill names and descriptions.
- Trigger conditions specific enough for routing.
- Minimal tool permissions.
- Explicit human approval gates for destructive, credentialed, deployment, or publishing actions.
- A branch and worktree strategy for code changes.
- A policy for generated artifacts.
- A policy for secrets, tokens, remotes, and logs.
- Verification loops for build, test, lint, smoke, and external integration checks.
- Handoff notes that preserve context without leaking secrets.

## Recommended output format

Return:

```txt
# Agent Ecosystem Architecture

## Current Map
[What exists and what each part does]

## Gaps
[Missing roles, risky tool access, unclear handoffs]

## Proposed Agents or Skills
[Names, triggers, responsibilities]

## Tool and MCP Wiring
[Servers, permissions, env vars, local dependencies]

## Safety Gates
[Where human confirmation is required]

## Verification
[How the system proves work was done correctly]

## Next Actions
[Ordered implementation steps]
```

## Gotchas

- Do not give every agent every tool.
- Do not store tokens in tracked files.
- Do not assume Docker, GitHub CLI, Git, or Node exists; check locally.
- Do not make MCP config executable until the dependency and credential story is clear.
- Do not design multi-agent workflows where no single agent owns final verification.
- Do not let agent routing depend on vague personality labels instead of observable triggers.

## Mental model

This skill turns agent setup into infrastructure. The outcome should make it obvious who acts, what they can touch, when they stop, and how the human can trust the result.

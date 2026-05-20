---
name: ultrathink-plan-revving
description: Use this skill when a user asks to think deeply, ultrathink, rev a plan, pressure-test an implementation approach, de-risk a multi-step change, or turn a vague objective into an execution-ready engineering plan. Trigger before high-blast-radius edits, branch/rebase/push operations, architecture changes, security-sensitive work, deployment changes, and complex debugging sessions.
---

# Ultrathink Plan Revving

Use this skill to convert broad intent into a plan that can survive contact with the repo, the runtime, and the user's real constraints.

## Operating mode

Start by slowing down enough to identify what kind of work this is:

```txt
intent -> constraints -> repo facts -> risk -> plan -> verification -> next action
```

The goal is not to create a decorative plan. The goal is to rev the plan until it is concrete, minimal, reversible where possible, and ready to execute.

## Phase 1: Frame the problem

Clarify:

- What outcome the user actually needs.
- Which branch, worktree, environment, or deployment target is in scope.
- Whether the request is exploratory, implementation-ready, review-only, or urgent repair.
- What must not be touched.
- Whether credentials, generated artifacts, or deployment state could be involved.
- What success will be measured against.

Prefer repo facts over assumptions. Read the relevant files, scripts, branch state, and recent history before making claims.

## Phase 2: Rev the plan

Build the plan in passes:

1. Identify the smallest useful change.
2. List known risks and unknowns.
3. Choose the repo-native path over a new pattern.
4. Decide which files should change and which should stay untouched.
5. Define verification before editing.
6. Mark rollback or containment options for risky steps.

For each step, ask:

```txt
Does this reduce uncertainty?
Does this preserve user work?
Does this avoid accidental deployment or credential exposure?
Does this produce a verifiable checkpoint?
```

## Phase 3: Execute or hand off

If the user asked for implementation, move from plan to action once the plan is sufficiently grounded.

When executing:

- Keep edits scoped.
- Update the checklist as each task completes.
- Check status before and after changes.
- Do not stage unrelated files.
- Avoid generated artifacts unless they are explicitly part of the deliverable.
- Verify with the closest available build, test, lint, smoke test, or command.
- Report anything that could not be verified.

When handing off:

- Provide exact commands.
- Include working directory context.
- Call out branch and remote assumptions.
- Include credential and deployment cautions when relevant.

## Plan shape

Use this format when a visible plan helps:

```txt
# Plan

## Goal
[One-sentence outcome]

## Facts
[Repo/environment facts discovered]

## Risks
[Prioritized risks]

## Steps
[Ordered implementation or investigation steps]

## Verification
[Commands/checks]

## Stop Conditions
[When to pause and ask the user]
```

## Stop conditions

Pause and ask before proceeding when:

- The target branch/worktree is ambiguous and the wrong choice could lose work.
- A command could rewrite history, delete files, deploy, rotate credentials, or publish externally.
- Credentials or tokens appear in config, logs, patches, or remotes.
- The repo state contradicts the user's expectation.
- Verification requires a service or tool that is unavailable.

## Gotchas

- Do not confuse a confident narrative with verified repo state.
- Do not let a plan grow larger than the actual risk warrants.
- Do not rebase, reset, force-push, or deploy without explicit user intent.
- Do not treat generated build output as source unless the repo clearly does.
- Do not stage case-collision or filemode churn as part of unrelated work.
- Do not hide uncertainty; convert it into a check or a question.

## Mental model

This skill is a planning clutch. It helps the agent shift from enthusiasm into traction: enough thinking to avoid expensive mistakes, enough decisiveness to keep the work moving.

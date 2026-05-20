---
name: ubuntu-pools-ux-review
description: Use this skill when reviewing Ubuntu Pools UX, layout structure, product information architecture, dashboard hierarchy, trust/ledger/governance flows, or React/Next.js components related to Ubuntu Pools. Trigger when the user asks to review, audit, restructure, improve, or critique Ubuntu Pools screens, routes, navigation, dashboards, waitlist pages, trust components, ledger views, compliance surfaces, or community-savings user journeys.
---

# Ubuntu Pools UX Review

Review Ubuntu Pools as a community-savings product, not as a generic dashboard.

## Core product spine

Evaluate every screen against this sequence:

```txt
Join -> Understand Pool -> Build Trust -> Contribute -> Track Ledger -> Govern Together
```

The UX should reduce uncertainty in this order:

```txt
identity -> purpose -> mechanism -> proof -> action
```

## Review checklist

Inspect:

- Route structure and whether pages map to a coherent user journey.
- Landing page clarity before conversion.
- Whether money movement is explained before asking for trust.
- Whether Ubuntu philosophy is connected to concrete product mechanics.
- Whether trust signals are understandable to non-technical users.
- Whether ledger proof is visible but not overly technical.
- Whether governance actions are discoverable.
- Whether compliance/POPIA/privacy controls are understandable.
- Whether admin/security tooling is separated from member UX.
- Whether visual language is consistent across public and authenticated surfaces.
- Whether component values are bounded, clamped, and truthful.

## Component checks

For score/progress components:

- Clamp visual percentages between 0 and 100.
- Show denominators where relevant.
- Explain what the score or circle measures.
- Avoid unexplained financial-style scoring.

For ledger/security components:

- Translate technical states into plain-language trust states.
- Keep deep technical controls in admin/audit views.
- Show proof, timestamp, and user consequence.

For onboarding/waitlist pages:

- Use one primary CTA.
- Explain risk, contribution mechanics, governance, and privacy before or near signup.
- Include links to privacy and FAQ if referenced elsewhere.

## Recommended information architecture

Prefer:

```txt
/
├── Hero
├── How It Works
├── Trust Layer
├── Ledger Layer
├── Governance Layer
├── Compliance Layer
└── Footer

/village
├── Current pool status
├── Ubuntu Score
├── Trust Circle
├── Active Pools
├── Recent Ledger Events
└── Governance Actions

/ledger
├── Contribution history
├── Payout history
├── Verification status
└── Audit/export

/profile
├── Identity status
├── Ubuntu Score explanation
├── Trust Circle membership
├── Consent settings
└── Data deletion request

/admin/security
├── Technical dashboard
├── Security controls
└── Operational compliance
```

## Output format

Return:

```txt
# Ubuntu Pools UX Review

## Diagnosis
[Direct assessment]

## Structural Issues
[Prioritized issues]

## Recommended Layout
[Route/page/component structure]

## Component Fixes
[Specific code-level or UX-level fixes]

## Priority Actions
[Ordered execution list]

## Verdict
[One concise product-structure conclusion]
```

## Gotchas

- Do not treat games as primary financial UX unless framed as learning.
- Do not expose security-control inventory as ordinary member UX.
- Do not let technical proof outrank user comprehension.
- Do not present Ubuntu Score as trustworthy unless its inputs are explained.
- Do not allow route references like `/faq#ubuntu-score` without ensuring `/faq` exists.
- Do not use generic fintech recommendations without mapping them to Ubuntu Pools' community, ledger, governance, and trust model.

## Mental model

The skill turns scattered React components and routes into a product journey audit. It reviews whether each interface element helps a user answer: "Who am I saving with, what are the rules, where did the money move, what proves it, and what must I do next?"

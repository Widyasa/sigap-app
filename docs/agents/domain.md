# Domain Docs

How the engineering skills should consume this repo's domain documentation.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — it points to one `CONTEXT.md` per context.
- **Each relevant `CONTEXT.md`** for the context you're touching.
- **`docs/adr/`** for system-wide ADRs.
- **Context-scoped ADRs** under `apps/<context>/docs/adr/` or `packages/<context>/docs/adr/`.

If any of these files don't exist, proceed silently. The `/domain-modeling` skill creates them lazily when terms or decisions actually get resolved.

## File structure

Multi-context repo:

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← system-wide decisions
├── apps/
│   ├── mobile/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/
│   └── admin/
│       ├── CONTEXT.md
│       └── docs/adr/
└── packages/
    ├── shared/
    │   ├── CONTEXT.md
    │   └── docs/adr/
    ├── supabase/
    │   ├── CONTEXT.md
    │   └── docs/adr/
    └── ai/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept, use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary avoids.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.

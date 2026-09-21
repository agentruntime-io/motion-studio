# Motion Studio — Agent Guide

Motion Studio is an **intermediate representation (IR) for AI-generated motion graphics**:

```
AI agent → Motion Studio JSON → deterministic renderer ↔ human visual fixes → MP4 / WebM
```

Give agents the files below instead of building an in-app chat box.

## Required reading

| File | Purpose |
|------|---------|
| [SKILL.md](./SKILL.md) | Authoring workflow, layer types, examples |
| [schema/motion-studio.schema.json](./schema/motion-studio.schema.json) | Machine-readable project contract |
| [fixtures/valid/](./fixtures/valid/) | Known-good project examples |

## Quick setup by tool

### Cursor
The skill is also installed at `.cursor/skills/motion-studio/SKILL.md`. Point the agent at the repo root and `SKILL.md`.

### Claude Code / Codex / other coding agents
1. Clone https://github.com/agentruntime-io/motion-studio
2. Read `SKILL.md` and `schema/motion-studio.schema.json`
3. Author `projects/my-video/project.json` + assets
4. Run `npm run validate` before opening the UI

## Validation

```bash
npm run validate
```

Checks all fixtures in `fixtures/valid/` and `fixtures/invalid/` against the JSON schema.

## Schema versioning

Every project should include:

```json
{
  "schemaVersion": "1.0"
}
```

When the schema changes, bump the version and add migration notes in `schema/CHANGELOG.md`.

## What to generate

Prefer **semantic layers** over raw rectangles:

- `flow` for workflow diagrams
- `title` / `overlay` for text and badges
- `video` for screen recordings and clips
- `scenes[]` for multi-part narratives (hook → demo → CTA)

Use project-level `theme` for fonts/colors instead of repeating hex codes.

## What not to send agents

- Do not embed private asset contents in prompts when avoidable — use `projectPath` + filenames
- Do not invent layer types outside the schema
- Do not rely on cloud rendering — export runs locally in the browser

## Human correction loop

After generation, humans fix the last 10% in the UI:

- Drag / resize layers on the preview canvas
- Arrow keys nudge (Shift = 10px)
- Ctrl/Cmd+D duplicate
- Timeline for timing tweaks

## Live app

https://ar-motion-studio.vercel.app/

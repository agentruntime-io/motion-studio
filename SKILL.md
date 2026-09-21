---
name: motion-studio
description: >-
  Build browser-rendered videos from JSON timelines using Motion Studio.
  Use for project.json authoring, schemaVersion 1.0, scenes, theme tokens,
  video clips, flow diagrams, preview edits, and WebM/MP4 export.
---

# Motion Studio Skill

**Give this file to your coding agent.**

Motion Studio is an IR for AI-generated motion graphics — not a chat-based video editor.

```
AI → Motion Studio JSON → deterministic renderer ↔ human fixes → MP4 / WebM
```

Also read: [AGENTS.md](./AGENTS.md) · [schema/motion-studio.schema.json](./schema/motion-studio.schema.json)

## Workflow

1. Create `projects/my-video/` with assets + `project.json`
2. Set `"schemaVersion": "1.0"`
3. Run `npm run validate`
4. `npm run dev` → preview and fix visually
5. Export WebM or MP4

## Minimal project

```json
{
  "schemaVersion": "1.0",
  "name": "My Video",
  "projectPath": "projects/my-video",
  "width": 1280,
  "height": 720,
  "fps": 30,
  "duration": 10,
  "theme": {
    "fonts": { "heading": "Inter, system-ui, sans-serif" },
    "colors": { "text": "#f8fafc", "primary": "#6366f1" }
  },
  "layers": [
    {
      "type": "title",
      "text": "Hello",
      "start": 0,
      "duration": 5,
      "width": 1280,
      "height": 120,
      "y": 300
    }
  ]
}
```

## Scenes (multi-part videos)

Use `scenes[]` instead of hand-offsetting `start` times. Scenes compile to a flat timeline at render time:

```json
{
  "schemaVersion": "1.0",
  "width": 1280,
  "height": 720,
  "fps": 30,
  "duration": 0,
  "scenes": [
    {
      "id": "hook",
      "duration": 3,
      "layers": [{ "type": "title", "text": "Hook", "start": 0, "duration": 3, "width": 1280, "height": 120, "y": 300 }]
    },
    {
      "id": "demo",
      "duration": 5,
      "layers": [{ "type": "flow", "start": 0, "duration": 5, "width": 1280, "height": 720, "nodes": [], "edges": [] }]
    }
  ],
  "layers": []
}
```

## Video clips

```json
{
  "type": "video",
  "src": "screen-recording.mp4",
  "start": 0,
  "duration": 8,
  "width": 1280,
  "height": 720,
  "fit": "contain",
  "trimStart": 1.5,
  "trimEnd": 9,
  "playbackRate": 1,
  "volume": 1,
  "loop": false
}
```

## Layer types

| type | use for |
|------|---------|
| `image` | photos, backgrounds, SVG/raster assets |
| `video` | screen recordings, MP4/WebM clips |
| `title` | headings |
| `overlay` | text badges, shapes, inline images |
| `audio` | voiceover/music (visual-only today) |
| `flow` | workflow diagrams (step/card/n8n nodes) |

## Validation

```bash
npm run validate
```

See `fixtures/valid/` and `fixtures/invalid/` for conformance examples.

## Human correction (UI)

After generation, humans fix timing and layout in the app:

- Drag layers on preview
- Resize with corner handle
- Arrow keys nudge (Shift = 10px)
- Ctrl/Cmd+D duplicate

## Export

- **WebM** — always available (VP9/VP8)
- **MP4** — H.264 via WebCodecs when supported

## Full reference

The complete skill with flow animation, keyframes, and templates lives at `.cursor/skills/motion-studio/SKILL.md`.

Schema source of truth: `schema/motion-studio.schema.json`

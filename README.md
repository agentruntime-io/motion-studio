# Motion Studio

**Browser-based programmable video creation.**

Open source · Runs locally · JSON-driven

Built by [AgentRuntime](https://agentruntime.io) · [GitHub](https://github.com/agentruntime-io/motion-studio)

---

Motion Studio is a local-first video compositor that turns JSON timelines into previewable canvas animations and WebM exports. No cloud rendering, no proprietary project format — just edit JSON, drop assets in a folder, and export.

## Features

- **Images** — URL, data URL, project files, inline SVG, or local folder
- **Transitions** — fade, slide, zoom, wipe (in/out)
- **Animations** — fade, slide, scale, bounce (in/out)
- **Keyframes** — property animation over time
- **Flow diagrams** — step timelines, cards, and branching n8n-style nodes
- **Titles & overlays** — text, shapes, badges, image overlays
- **Effects** — blur, brightness, contrast, grayscale, sepia, vignette, glow
- **Preview** — real-time canvas playback with timeline scrubber
- **Export** — download as WebM video

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 — edit JSON, preview, export.

## Project resources

Video assets live in **`projects/`** at the repo root (gitignored — never committed).

```
projects/
  my-video/
    project.json
    hero.jpg
    logo.svg
```

Set **Project Path** to `projects/my-video` in the UI, then **Load project.json**.

Or use **Open local folder…** to load assets from any directory on disk.

## Image sources

| Format | Example | Notes |
|--------|---------|-------|
| URL | `https://example.com/photo.jpg` | CORS required |
| Data URL | `data:image/png;base64,...` | Embedded in JSON |
| Project file | `hero.jpg` | Requires `projectPath` → `projects/{name}/hero.jpg` |
| Inline SVG | `"<svg>...</svg>"` | Embedded in JSON |
| Local folder | `logo.svg` | Via **Open local folder…** in UI |

## JSON example

```json
{
  "name": "My Video",
  "projectPath": "projects/my-video",
  "width": 1280,
  "height": 720,
  "fps": 30,
  "duration": 10,
  "layers": [
    {
      "type": "image",
      "src": "hero.jpg",
      "start": 0,
      "duration": 5,
      "width": 1280,
      "height": 720
    }
  ]
}
```

## Agent skill

For Cursor agents authoring timelines, see [.cursor/skills/motion-studio/SKILL.md](.cursor/skills/motion-studio/SKILL.md).

## Export notes

- Output: **WebM** (VP9/VP8) or **MP4** (H.264 via WebCodecs)
- Export renders frame-by-frame at the specified FPS

## Schema & validation

- Machine-readable contract: [`schema/motion-studio.schema.json`](schema/motion-studio.schema.json)
- Projects should include `"schemaVersion": "1.0"`
- Validate fixtures: `npm run validate`
- Agent docs: [`SKILL.md`](SKILL.md) · [`AGENTS.md`](AGENTS.md)

## Analytics (PostHog)

Optional product analytics for the live site. Disabled locally unless you configure it.

1. Create a project at [posthog.com](https://posthog.com)
2. Copy `.env.example` → `.env` and set `VITE_POSTHOG_KEY`
3. On Vercel, add the same env vars in project settings
4. Redeploy

Events tracked: page views, project load, preview play, export, save, flow editor, prerender. No project JSON or asset paths are sent.

## License

[Apache-2.0](LICENSE) © AgentRuntime

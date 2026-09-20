# JSON Video Studio

Generate videos in the browser from a JSON timeline definition. Built with **React + Vite + TypeScript**.

## Features

- **Images** — URL, data URL, project files, inline SVG, or local folder
- **Transitions** — fade, slide, zoom, wipe (in/out)
- **Animations** — fade, slide, scale, bounce (in/out)
- **Titles** — styled text layers with shadows
- **Overlays** — text badges, shapes, image overlays
- **Effects** — blur, brightness, contrast, grayscale, sepia, vignette, glow
- **Preview** — real-time canvas playback with timeline scrubber
- **Export** — download as WebM video

## Quick Start

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

See [.cursor/skills/json-video-studio/SKILL.md](.cursor/skills/json-video-studio/SKILL.md).

## Export notes

- Output: **WebM** (VP9/VP8)
- Export renders frame-by-frame at the specified FPS

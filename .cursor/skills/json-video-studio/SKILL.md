---
name: json-video-studio
description: >-
  Build browser-rendered videos from JSON timelines using the JSON Video Studio
  app (React/Vite canvas compositor). Use when creating video projects, authoring
  timeline JSON, adding images/SVG/transitions/overlays/animations/effects, placing
  assets in projects/ folder, or exporting WebM from the video-editor repo.
---

# JSON Video Studio

Generate videos by authoring a JSON project file consumed by the app at `c:\agentruntime\video-editor`.

## Quick workflow

```
Task Progress:
- [ ] 1. Gather assets (images, SVG, logos)
- [ ] 2. Create projects/my-video/ with project.json + assets
- [ ] 3. Write timeline JSON (see schema below)
- [ ] 4. Validate JSON parses
- [ ] 5. Preview in app (npm run dev → set project path → Load project.json)
- [ ] 6. Export WebM
```

## Run the app

```bash
cd c:\agentruntime\video-editor
npm install
npm run dev
```

Open http://localhost:5173 — set **Project Path**, load JSON, preview, **Export WebM Video**.

## Resource locations

| Method | On disk | When to use |
|--------|---------|-------------|
| **projects/ folder** | `projects/my-video/` (gitignored) | Default — keeps assets out of the app repo |
| **Local folder picker** | Any directory | Quick iteration without copying files |
| **Embedded** | URLs, data URLs, inline SVG in JSON | No files needed |

**Never** put video assets in `public/` — that pollutes the app project.

## Project JSON schema

```json
{
  "name": "My Video",
  "projectPath": "projects/my-video",
  "width": 1280,
  "height": 720,
  "fps": 30,
  "duration": 10,
  "backgroundColor": "#0a0a0f",
  "layers": []
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `width`, `height` | yes | Canvas size in pixels |
| `fps` | yes | Frame rate for preview + export |
| `duration` | yes | Total timeline length in seconds |
| `projectPath` | yes* | Folder under `projects/`, e.g. `projects/my-video` |
| `backgroundColor` | no | Hex/rgb, default `#000000` |
| `layers` | yes | Array of layer objects, sorted by `zIndex` |

\*Required for relative file paths. Not needed if all assets are URLs, data URLs, inline SVG, or loaded via local folder picker.

## Image `src` formats

| Format | Example | Resolves to |
|--------|---------|-------------|
| HTTPS URL | `"https://example.com/photo.jpg"` | as-is |
| Data URL | `"data:image/png;base64,..."` | as-is |
| Project file | `"hero.jpg"` | `/projects/my-video/hero.jpg` |
| Subpath | `"images/hero.jpg"` | `/projects/my-video/images/hero.jpg` |
| Inline SVG | `"<svg xmlns=...>...</svg>"` | data URL |
| Local folder | `"logo.svg"` | blob URL from selected folder |

**Agent rule:** Create `projects/client-name/project.json` plus assets alongside it. Set `"projectPath": "projects/client-name"`. Reference files by name: `"src": "logo.svg"`. Do not use OS paths like `C:\Users\...`.

### Adding assets

```bash
mkdir -p projects/my-video
cp hero.jpg logo.svg projects/my-video/
```

Write `projects/my-video/project.json`, then in app: path = `projects/my-video` → **Load project.json**.

Copy the template from [.cursor/skills/json-video-studio/template/demo-reel/](template/demo-reel/) to get started.

## Layer types

See [examples.md](examples.md) for full layer examples.

**Transitions:** fade, slideLeft, slideRight, slideUp, slideDown, zoomIn, zoomOut, wipeLeft, wipeRight

**Animations:** fadeIn, fadeOut, slideInLeft, slideInRight, slideInUp, slideInDown, scaleIn, scaleOut, bounce

**Effects:** blur, brightness, contrast, grayscale, sepia, vignette, glow

## Timing rules

- `start` — when layer becomes visible (seconds)
- `duration` — how long layer is active (seconds)
- Higher `zIndex` draws on top
- Overlap layers for cross-dissolves

## Authoring checklist

- [ ] `projectPath` set if using file-based assets
- [ ] Files live in `projects/{name}/` not `public/`
- [ ] `duration` covers the last layer
- [ ] JSON is valid (no trailing commas)

## Reference files

- Sample on disk: `projects/demo-reel/` (gitignored locally)
- Template: [template/demo-reel/](template/demo-reel/)
- Types: [src/types/project.ts](../../src/types/project.ts)
- Examples: [examples.md](examples.md)

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Assets in `public/` | Use `projects/my-video/` instead |
| `"src": "C:\\photos\\a.jpg"` | Use `projects/my-video/photo.jpg` |
| Relative path without projectPath | Set `projectPath` or use local folder |
| Image 404 | File must exist in `projects/{projectPath}/` |

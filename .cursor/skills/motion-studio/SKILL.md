---
name: motion-studio
description: >-
  Build browser-rendered videos from JSON timelines using Motion Studio
  (React/Vite canvas compositor). Use when creating video projects, authoring
  timeline JSON, adding images/SVG/transitions/overlays/animations/effects/keyframes,
  flow diagrams, placing assets in projects/ folder, saving or opening project.json,
  or exporting WebM. Repo: https://github.com/agentruntime-io/motion-studio
---

# Motion Studio

Browser-based programmable video creation. Open source · Runs locally · JSON-driven.

Generate videos by authoring a JSON project file. Preview and WebM export run entirely in the browser.

## Quick workflow

```
Task Progress:
- [ ] 1. Gather assets (images, SVG, logos)
- [ ] 2. Create projects/my-video/ with project.json + assets
- [ ] 3. Write timeline JSON (see schema below)
- [ ] 4. npm run dev → edit in UI or JSON drawer
- [ ] 5. Save project (Ctrl+S) to projects/my-video/project.json
- [ ] 6. Export WebM
```

## Run the app

```bash
git clone https://github.com/agentruntime-io/motion-studio.git
cd motion-studio
npm install
npm run dev
```

Open http://localhost:5173

## App layout

| Area | Purpose |
|------|---------|
| **Header** | Open, Save, JSON, Export, undo/redo |
| **Properties** (left) | Layer fields, keyframes, flow timing |
| **Preview** (center top) | Canvas playback |
| **Timeline** (center bottom) | Clips, playhead, keyframe diamonds |
| **JSON drawer** | Project folder → Schema Reference → JSON editor |

Panel sizes are draggable (splitters) and persist in localStorage.

Flow layers: select clip → **Properties → Edit flow…** opens the visual flow editor modal.

## File operations

| Action | UI | Shortcut |
|--------|-----|----------|
| Open `.json` | **Open** | Ctrl+O |
| Save to disk | **Save** → pick `projects/my-video` | Ctrl+S |
| Edit JSON | **JSON** drawer → Apply JSON | — |
| Import assets folder | JSON drawer → **Import folder…** | — |
| Reload from disk | JSON drawer → **Reload project.json** | — |
| Export video | **Export** | — |

Save writes `projects/{folder}/project.json` via the **local dev server** only. On static hosting, Save downloads JSON instead. **Export** always runs in the browser and downloads WebM.

UI edits sync to JSON automatically.

## Resource locations

| Method | On disk | When to use |
|--------|---------|-------------|
| **projects/ folder** | `projects/my-video/` (gitignored) | Default — keeps assets out of the app repo |
| **Import folder** | Any directory (browser blob URLs) | Quick iteration without copying files |
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
| `backgroundColor` | no | Hex/rgb |
| `layers` | yes | Array of layer objects, sorted by `zIndex` |

\*Required for relative file paths. Not needed if all assets are URLs, data URLs, inline SVG, or loaded via Import folder.

## Layer types

| type | Key fields |
|------|------------|
| `image` | `src`, `fit?`: cover \| contain \| fill |
| `title` | `text`, `style?` |
| `overlay` | `overlayType`: text \| image \| shape, `text?`, `src?`, `shape?`, `style?` |
| `audio` | `src`, `volume?` |
| `flow` | `nodes[]`, `edges[]`, `flowAnimation?`, `theme?`, `defaultNodeStyle?` |

See [examples.md](examples.md) for full layer examples.

**Transitions:** fade, slideLeft, slideRight, slideUp, slideDown, zoomIn, zoomOut, wipeLeft, wipeRight

**Animations:** fadeIn, fadeOut, slideInLeft, slideInRight, slideInUp, slideInDown, scaleIn, scaleOut, bounce

**Effects:** blur, brightness, contrast, grayscale, sepia, vignette, glow

## Keyframes

Per-layer custom animation:

```json
"keyframes": {
  "name": "Ken Burns",
  "tracks": [
    {
      "property": "scale",
      "keyframes": [
        { "t": 0, "value": 1, "easing": "linear" },
        { "t": 4, "value": 1.15, "easing": "easeInOut" }
      ]
    },
    {
      "property": "x",
      "keyframes": [
        { "t": 0, "value": 0 },
        { "t": 4, "value": -40 }
      ]
    }
  ]
}
```

| Property | Applies to |
|----------|------------|
| opacity, x, y, scale, rotation, width, height | All visual layers |
| color, fontSize | title, text overlay |
| backgroundColor | overlay |

- `t` — seconds **from layer start** (not global timeline)
- `x` / `y` values are **offsets** added to the layer's base position
- Easing: linear, easeIn, easeOut, easeInOut
- Stacks on top of transition/animation presets

In the UI: select a clip → **Properties → Keyframes**, or press **K** at playhead.

## Flow layers

Process diagrams with animated edges and nodes (step timelines, cards, n8n-style automation nodes):

```json
{
  "type": "flow",
  "start": 0,
  "duration": 8,
  "defaultNodeStyle": "step",
  "flowAnimation": {
    "mode": "sequential",
    "stepDelay": 0.35,
    "lineDuration": 0.35,
    "nodeDuration": 0.3,
    "sequence": ["n1", "n2", "n3"]
  },
  "nodes": [
    { "id": "n1", "style": "step", "label": "Start", "number": 1, "x": 120, "y": 320 },
    { "id": "n2", "style": "card", "label": "Review", "number": 2, "x": 360, "y": 280 }
  ],
  "edges": [{ "from": "n1", "to": "n2" }]
}
```

- **Node styles:** `step`, `card`, `n8n`
- **Animation modes:** `sequential`, `parallel`, `instant`
- **Branching:** edges into a node animate before the node appears
- **Edge tokens in sequence:** `"edge:n1->n2"`
- **Waypoints:** `"edges": [{ "from": "a", "to": "b", "points": [{ "x": 500, "y": 200 }] }]`

Use **Edit flow…** in Properties for drag-and-drop editing, Connect mode, and Auto sequence.

## Image `src` formats

| Format | Example | Resolves to |
|--------|---------|-------------|
| HTTPS URL | `"https://example.com/photo.jpg"` | as-is |
| Data URL | `"data:image/png;base64,..."` | as-is |
| Project file | `"hero.jpg"` | `/projects/my-video/hero.jpg` (dev) |
| Subpath | `"images/hero.jpg"` | `/projects/my-video/images/hero.jpg` |
| Inline SVG | `"<svg xmlns=...>...</svg>"` | data URL |
| Import folder | `"logo.svg"` | blob URL from selected folder |

**Agent rule:** Create `projects/client-name/project.json` plus assets alongside it. Set `"projectPath": "projects/client-name"`. Reference files by name: `"src": "logo.svg"`. Do not use OS paths like `C:\Users\...`.

### Adding assets

```bash
mkdir -p projects/my-video
cp hero.jpg logo.svg projects/my-video/
```

Write `projects/my-video/project.json`, then **Save** or set folder path and **Reload project.json**.

Copy the template from [template/demo-reel/](template/demo-reel/) to get started.

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
- [ ] Keyframe `t` values within layer duration
- [ ] Flow `sequence` lists every node id (or use Auto sequence in UI)
- [ ] Saved with Ctrl+S before closing the browser (dev)

## Reference files

- Template: [template/demo-reel/](template/demo-reel/)
- Types: [src/types/project.ts](../../src/types/project.ts)
- Examples: [examples.md](examples.md)
- In-app schema: JSON drawer → **JSON Schema Reference**

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Assets in `public/` | Use `projects/my-video/` instead |
| `"src": "C:\\photos\\a.jpg"` | Use `projects/my-video/photo.jpg` |
| Relative path without projectPath | Set `projectPath` or Import folder |
| Image 404 | File must exist in `projects/{projectPath}/` (dev) |
| Keyframes on wrong layer | Keyframes are per-layer; select each clip |
| x/y keyframe doesn't move layer | Values are offsets; use 0 → 50 → 100 etc. |
| Lost edits after refresh | Save with Ctrl+S to project.json |
| Save fails on Vercel | Expected — use download or run locally with `npm run dev` |

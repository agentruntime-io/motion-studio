export const SCHEMA_HELP = `MOTION STUDIO — JSON SCHEMA REFERENCE
https://github.com/agentruntime-io/motion-studio

Runs in the browser. Preview + WebM export are client-side.
Dev-only: Save writes projects/{folder}/project.json via local Vite server.

═══════════════════════════════════════════════════════════════
PROJECT ROOT
═══════════════════════════════════════════════════════════════
{
  "name": "My Video",
  "width": 1280,
  "height": 720,
  "fps": 30,
  "duration": 10,
  "backgroundColor": "#0a0a0f",
  "projectPath": "projects/my-video",
  "layers": [ ... ]
}

  name            optional display name
  width, height   canvas pixels (required)
  fps             frame rate for preview + export (required)
  duration        timeline length in seconds (required)
  backgroundColor optional canvas fill
  projectPath     folder under projects/ for relative asset paths
  layers          array of layer objects (required)

═══════════════════════════════════════════════════════════════
LAYER (common fields)
═══════════════════════════════════════════════════════════════
  id?, start, duration
  x?, y?, width?, height?, opacity?, zIndex?, rotation?
  transition?: { in?, out?, duration? }
  animation?: { in?, out?, duration?, easing? }
  keyframes?: { name?, tracks: [...] }
  effects?: [{ type, value?, intensity? }]

  start     when layer becomes visible (seconds, global timeline)
  duration  how long layer is active (seconds)
  zIndex    higher draws on top

═══════════════════════════════════════════════════════════════
LAYER TYPES
═══════════════════════════════════════════════════════════════
  image     src, fit?: cover|contain|fill
  title     text, style?: { fontSize, color, align, fontWeight, shadow? }
  overlay   overlayType: text|image|shape, text?, src?, shape?, style?
  audio     src, volume?
  flow      nodes[], edges[], flowAnimation?, theme?, defaultNodeStyle?

═══════════════════════════════════════════════════════════════
KEYFRAMES (per layer)
═══════════════════════════════════════════════════════════════
Times are seconds from layer start (not global timeline).

  keyframes: {
    "name": "Ken Burns",
    "tracks": [
      {
        "property": "scale",
        "keyframes": [
          { "t": 0, "value": 1, "easing": "linear" },
          { "t": 4, "value": 1.15, "easing": "easeInOut" }
        ]
      },
      { "property": "x", "keyframes": [{ "t": 0, "value": 0 }, { "t": 4, "value": -40 }] }
    ]
  }

  Properties: opacity, x, y, scale, rotation, width, height,
              color, fontSize (title / text overlay),
              backgroundColor (overlay)

  x / y values are OFFSETS added to the layer's base x/y.
  Easing: linear, easeIn, easeOut, easeInOut
  Stacks on top of transition/animation presets.

  UI: select clip → Properties → Keyframes, or press K at playhead.

═══════════════════════════════════════════════════════════════
FLOW LAYER (process / n8n-style diagrams)
═══════════════════════════════════════════════════════════════
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
      { "id": "n1", "style": "step", "label": "Detect", "number": 1, "x": 120, "y": 320 },
      { "id": "n2", "style": "card", "label": "Review", "number": 2, "x": 360, "y": 280 },
      { "id": "n3", "style": "n8n", "label": "HTTP Request", "icon": "🌐", "x": 600, "y": 300 }
    ],
    "edges": [
      { "from": "n1", "to": "n2" },
      { "from": "n2", "to": "n3" }
    ]
  }

  Node styles: step (numbered circle), card (white card + badge), n8n (automation node)
  Animation modes: sequential | parallel | instant
  Edges draw with stroke-dash reveal, then nodes pop in.

  Branching: incoming edges animate before each node in sequence.
  Split edges fan out with auto waypoints.

  Explicit edge timing in sequence:
    "sequence": ["n1", "edge:n1->n2", "n2", "edge:n2->n3", "n3"]

  Reveal timeline (Edit flow modal):
    "tracks": [{
      "id": "main",
      "entries": ["n1", "edge:n1->n2", "n2", { "parallel": ["edge:n2->a", "a"] }],
      "waitForTracks": [{ "afterEntry": 2, "tracks": ["branch-a"] }]
    }, {
      "id": "branch-a",
      "parallelWith": "main",
      "parallelAfterEntry": 1,
      "entries": ["edge:n2->side", "side"]
    }]
  highlightActive?: true — dims previous steps while the reveal plays

  Custom routing:
    "edges": [{ "from": "a", "to": "b", "points": [{ "x": 500, "y": 200 }] }]

  UI: select flow clip → Properties → Edit flow… (visual editor modal)

  theme?: {
    lineColor?, lineWidth?, badgeColor?, cardBackground?, cardBorder?,
    n8nBackground?, n8nBorder?, labelColor?, subtitleColor?
  }

═══════════════════════════════════════════════════════════════
TRANSITIONS (layer.transition.in / out)
═══════════════════════════════════════════════════════════════
  fade, slideLeft, slideRight, slideUp, slideDown,
  zoomIn, zoomOut, wipeLeft, wipeRight

═══════════════════════════════════════════════════════════════
ANIMATIONS (layer.animation.in / out)
═══════════════════════════════════════════════════════════════
  fadeIn, fadeOut, slideInLeft, slideInRight,
  slideInUp, slideInDown, scaleIn, scaleOut, bounce

═══════════════════════════════════════════════════════════════
EFFECTS (layer.effects[])
═══════════════════════════════════════════════════════════════
  blur, brightness, contrast, grayscale, sepia, vignette, glow

═══════════════════════════════════════════════════════════════
IMAGE src
═══════════════════════════════════════════════════════════════
  https://...           URL (CORS required)
  data:image/...        data URL
  hero.jpg              → /{projectPath}/hero.jpg (dev server)
  images/logo.svg       → /{projectPath}/images/logo.svg
  "<svg ...>"           inline SVG → data URL
  logo.svg              blob URL when using Import folder in UI

═══════════════════════════════════════════════════════════════
APP UI
═══════════════════════════════════════════════════════════════
  Header: Open (Ctrl+O), Save (Ctrl+S), JSON, Export, undo/redo
  Left:   Properties (transform, transitions, keyframes, flow timing)
  Center: Preview + Timeline (clips, playhead, keyframe diamonds)
  JSON drawer: Project folder → Schema Reference → JSON editor

  Save (dev): writes projects/{folder}/project.json
  Save (prod): downloads project.json if no dev server
  Export: downloads WebM (rendered in browser)

  Keyboard:
    Ctrl+O open   Ctrl+S save   Ctrl+Z undo   Ctrl+Shift+Z redo
    K add keyframe at playhead   Delete remove selected keyframe
    Ctrl+C / Ctrl+V copy/paste keyframes on selected layer

  Files on disk: projects/{name}/project.json + assets (gitignored)`

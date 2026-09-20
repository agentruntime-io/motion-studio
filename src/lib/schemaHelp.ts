export const SCHEMA_HELP = `PROJECT ROOT
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

LAYER (common fields)
  id?, start, duration, x?, y?, width?, height?, opacity?, zIndex?, rotation?
  transition?: { in?, out?, duration? }
  animation?: { in?, out?, duration?, easing? }
  keyframes?: { name?, tracks: [...] }
  effects?: [{ type, value?, intensity? }]

LAYER TYPES
  image     — src, fit?: cover|contain|fill
  title     — text, style?: { fontSize, color, align, fontWeight, shadow? }
  overlay   — overlayType: text|image|shape, text?, src?, shape?, style?
  audio     — src, volume?
  flow      — nodes[], edges[], flowAnimation?, theme?, defaultNodeStyle?

FLOW LAYER (process / n8n-style diagrams)
  {
    "type": "flow",
    "start": 0, "duration": 8,
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
      { "id": "n2", "style": "card", "label": "PM reviews", "number": 2, "x": 360, "y": 280 },
      { "id": "n3", "style": "n8n", "label": "HTTP Request", "icon": "🌐", "x": 600, "y": 300 }
    ],
    "edges": [
      { "from": "n1", "to": "n2" },
      { "from": "n2", "to": "n3" }
    ]
  }

  Node styles: step (numbered circle), card (white card + badge), n8n (automation node)
  Animation: edges draw with SVG stroke-dash, then nodes pop in

  Branching (n8n split):
    "sequence": ["n1", "n2", "n3", "n4", "n5"]
    Incoming edges animate automatically before each node appears.
    Split edges from one node fan out with auto waypoints.

  Explicit edge timing in sequence:
    "sequence": ["n1", "edge:n1->n2", "n2", "edge:n2->n3", "n3"]

  Custom edge routing:
    "edges": [{ "from": "a", "to": "b", "points": [{ "x": 500, "y": 200 }] }]
    Drag the orange waypoint handle in the visual flow editor.

  Visual editor: select flow clip → Properties → drag nodes, Connect mode, Auto sequence
 (per layer, times are seconds from layer start)
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
              color, fontSize (text/title), backgroundColor (overlay)

  x/y keyframe values are OFFSETS added to layer x/y (not absolute positions).
  Legacy field "workflow" still loads but prefer "keyframes".

TRANSITIONS
  fade, slideLeft, slideRight, slideUp, slideDown,
  zoomIn, zoomOut, wipeLeft, wipeRight

ANIMATIONS
  fadeIn, fadeOut, slideInLeft, slideInRight,
  slideInUp, slideInDown, scaleIn, scaleOut, bounce

EASING (keyframes + animation)
  linear, easeIn, easeOut, easeInOut

EFFECTS
  blur, brightness, contrast, grayscale, sepia, vignette, glow

IMAGE src
  https://...           URL
  data:image/...        data URL
  hero.jpg              → /{projectPath}/hero.jpg
  "<svg ...>"           inline SVG → data URL
  (Import folder…)      blob URLs for local assets

APP UI (header)
  Open (Ctrl+O)   — open a .json file
  Save (Ctrl+S)   — save project.json to projects/{folder}
  JSON            — edit raw JSON in this drawer
  Export          — download WebM video

EDITOR
  Left: Properties (keyframes, transform, transitions)
  Center: Preview + Timeline (drag clips, keyframe diamonds)
  Drag panel splitters to resize Properties / Preview / Timeline

KEYBOARD
  Ctrl+O  open   Ctrl+S  save   Ctrl+Z  undo   Ctrl+Shift+Z  redo
  K       add keyframe at playhead   Delete  remove selected keyframe
  Ctrl+C / Ctrl+V  copy/paste keyframes on selected layer

Files on disk: projects/{name}/project.json + assets (gitignored)`

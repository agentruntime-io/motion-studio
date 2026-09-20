# Motion Studio — Examples

## Minimal slideshow

```json
{
  "name": "Slideshow",
  "projectPath": "projects/slideshow",
  "width": 1280,
  "height": 720,
  "fps": 30,
  "duration": 8,
  "layers": [
    {
      "type": "image",
      "src": "slide1.jpg",
      "start": 0,
      "duration": 4,
      "width": 1280,
      "height": 720,
      "transition": { "out": "fade", "duration": 0.6 }
    },
    {
      "type": "image",
      "src": "slide2.jpg",
      "start": 3.4,
      "duration": 4.6,
      "width": 1280,
      "height": 720,
      "transition": { "in": "fade", "duration": 0.6 }
    }
  ]
}
```

Files: `projects/slideshow/slide1.jpg`, `projects/slideshow/slide2.jpg`

## Brand intro with logo

```json
{
  "name": "Brand Intro",
  "projectPath": "projects/brand-intro",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "duration": 5,
  "backgroundColor": "#111",
  "layers": [
    {
      "type": "image",
      "src": "hero-bg.jpg",
      "start": 0,
      "duration": 5,
      "width": 1920,
      "height": 1080,
      "effects": [{ "type": "vignette", "intensity": 0.5 }]
    },
    {
      "type": "overlay",
      "overlayType": "image",
      "src": "logo.svg",
      "start": 0.3,
      "duration": 4,
      "x": 860,
      "y": 440,
      "width": 200,
      "height": 200,
      "zIndex": 10,
      "animation": { "in": "scaleIn", "duration": 0.8, "easing": "easeOut" }
    },
    {
      "type": "title",
      "text": "Product Launch",
      "start": 1.5,
      "duration": 3,
      "y": 700,
      "width": 1920,
      "height": 100,
      "zIndex": 11,
      "animation": { "in": "slideInUp", "out": "fadeOut", "duration": 0.5 },
      "style": { "fontSize": 56, "color": "#fff", "align": "center" }
    }
  ]
}
```

## Flow diagram (step timeline)

```json
{
  "name": "Process Flow",
  "projectPath": "projects/process",
  "width": 1280,
  "height": 720,
  "fps": 30,
  "duration": 10,
  "backgroundColor": "#0f172a",
  "layers": [
    {
      "type": "flow",
      "start": 0,
      "duration": 8,
      "defaultNodeStyle": "step",
      "flowAnimation": {
        "mode": "sequential",
        "stepDelay": 0.4,
        "lineDuration": 0.35,
        "nodeDuration": 0.3,
        "sequence": ["n1", "n2", "n3", "n4"]
      },
      "nodes": [
        { "id": "n1", "style": "step", "label": "Detect", "number": 1, "x": 100, "y": 360 },
        { "id": "n2", "style": "step", "label": "Triage", "number": 2, "x": 340, "y": 360 },
        { "id": "n3", "style": "card", "label": "PM reviews", "number": 3, "x": 580, "y": 320 },
        { "id": "n4", "style": "n8n", "label": "Notify Slack", "icon": "💬", "x": 820, "y": 340 }
      ],
      "edges": [
        { "from": "n1", "to": "n2" },
        { "from": "n2", "to": "n3" },
        { "from": "n3", "to": "n4" }
      ]
    }
  ]
}
```

## Branching flow (n8n split)

```json
{
  "type": "flow",
  "start": 0,
  "duration": 12,
  "defaultNodeStyle": "n8n",
  "flowAnimation": {
    "mode": "sequential",
    "sequence": ["trigger", "check", "path-a", "path-b", "merge"]
  },
  "nodes": [
    { "id": "trigger", "label": "Webhook", "icon": "⚡", "x": 120, "y": 360 },
    { "id": "check", "label": "IF", "icon": "?", "x": 320, "y": 360 },
    { "id": "path-a", "label": "Email", "icon": "✉", "x": 520, "y": 260 },
    { "id": "path-b", "label": "Slack", "icon": "💬", "x": 520, "y": 460 },
    { "id": "merge", "label": "Done", "icon": "✓", "x": 720, "y": 360 }
  ],
  "edges": [
    { "from": "trigger", "to": "check" },
    { "from": "check", "to": "path-a" },
    { "from": "check", "to": "path-b" },
    { "from": "path-a", "to": "merge" },
    { "from": "path-b", "to": "merge" }
  ]
}
```

## Keyframe drift (overlay text)

```json
{
  "type": "overlay",
  "overlayType": "text",
  "text": "Drifting caption",
  "start": 1,
  "duration": 3,
  "x": 640,
  "y": 400,
  "width": 400,
  "height": 60,
  "zIndex": 10,
  "keyframes": {
    "tracks": [
      {
        "property": "y",
        "keyframes": [
          { "t": 0, "value": 20, "easing": "easeOut" },
          { "t": 3, "value": -20, "easing": "easeInOut" }
        ]
      },
      {
        "property": "opacity",
        "keyframes": [
          { "t": 0, "value": 0.5 },
          { "t": 1.5, "value": 1 },
          { "t": 3, "value": 0.7 }
        ]
      }
    ]
  },
  "style": { "fontSize": 28, "color": "#fff", "align": "center" }
}
```

## Agent checklist

1. Copy template: `cp -r .cursor/skills/motion-studio/template/demo-reel projects/my-video`
2. Edit `projects/my-video/project.json` and add assets
3. In app: **Open** or set folder → **Reload project.json**
4. Edit timeline / keyframes / flow in UI
5. **Save** (Ctrl+S) → `projects/my-video`
6. **Export** WebM

# JSON Video Studio — Examples

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

## Mixed sources (URL + project file)

```json
{
  "projectPath": "projects/mixed",
  "width": 1280,
  "height": 720,
  "fps": 30,
  "duration": 6,
  "layers": [
    {
      "type": "image",
      "src": "https://picsum.photos/1280/720",
      "start": 0,
      "duration": 6,
      "width": 1280,
      "height": 720,
      "transition": { "in": "zoomIn", "duration": 0.8 }
    },
    {
      "type": "overlay",
      "overlayType": "image",
      "src": "badge.svg",
      "start": 1,
      "duration": 4,
      "x": 50,
      "y": 50,
      "width": 100,
      "height": 100,
      "zIndex": 5
    }
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

## Agent workflow

1. Copy template: `cp -r .cursor/skills/json-video-studio/template/demo-reel projects/my-video`
2. Edit `projects/my-video/project.json` and add assets
3. In app: **Open** or set folder → **Reload project.json**
4. Edit timeline / keyframes in UI
5. **Save** (Ctrl+S) → `projects/my-video`
6. **Export** WebM

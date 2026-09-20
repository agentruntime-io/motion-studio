interface JsonEditorProps {
  value: string
  onChange: (value: string) => void
  error: string | null
  onApply: () => void
  onReset: () => void
}

export function JsonEditor({ value, onChange, error, onApply, onReset }: JsonEditorProps) {
  return (
    <div className="json-editor">
      <div className="panel-header">
        <h2>Project JSON</h2>
        <div className="panel-actions">
          <button type="button" className="btn btn-ghost" onClick={onReset}>
            Reset Sample
          </button>
          <button type="button" className="btn btn-primary" onClick={onApply}>
            Apply JSON
          </button>
        </div>
      </div>

      <textarea
        className={`json-textarea ${error ? 'has-error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />

      {error && <p className="error-message">{error}</p>}

      <details className="schema-help">
        <summary>JSON Schema Reference</summary>
        <pre>{SCHEMA_HELP}</pre>
      </details>
    </div>
  )
}

const SCHEMA_HELP = `{
  "name": "My Video",
  "width": 1280,
  "height": 720,
  "fps": 30,
  "duration": 10,
  "backgroundColor": "#000000",
  "projectPath": "projects/my-video",
  "layers": [
    {
      "type": "image",
      "src": "https://... | data:image/... | hero.jpg | logo.svg",
      "start": 0,
      "duration": 5,
      "fit": "cover",
      "transition": { "in": "fade", "out": "slideLeft", "duration": 0.5 },
      "effects": [{ "type": "vignette", "intensity": 0.4 }]
    },
    {
      "type": "title",
      "text": "Hello World",
      "start": 1,
      "duration": 3,
      "y": 300,
      "width": 1280,
      "height": 100,
      "animation": { "in": "slideInUp", "out": "fadeOut", "duration": 0.6 },
      "style": { "fontSize": 64, "color": "#fff", "align": "center" }
    },
    {
      "type": "overlay",
      "overlayType": "text",
      "text": "Lower third",
      "start": 2,
      "duration": 4,
      "x": 40, "y": 600, "width": 400, "height": 50,
      "style": { "backgroundColor": "rgba(0,0,0,0.5)", "borderRadius": 6 }
    }
  ]
}

Transitions: fade, slideLeft, slideRight, slideUp, slideDown,
             zoomIn, zoomOut, wipeLeft, wipeRight

Animations: fadeIn, fadeOut, slideInLeft, slideInRight,
            slideInUp, slideInDown, scaleIn, scaleOut, bounce

Effects: blur, brightness, contrast, grayscale, sepia, vignette, glow

Image src formats:
  - URL:        https://example.com/photo.jpg
  - Data URL:   data:image/png;base64,...
  - Project:    hero.jpg  → /{projectPath}/hero.jpg (requires projectPath)
  - Inline SVG: "<svg xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"
  - Local folder: use Open local folder in UI (blob URLs)

Project path: set in UI or JSON "projectPath" field.
Files on disk go in projects/{name}/ (gitignored)`

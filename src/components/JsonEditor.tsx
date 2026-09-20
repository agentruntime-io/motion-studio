interface JsonEditorProps {
  value: string
  onChange: (value: string) => void
  error: string | null
  onApply: () => void
  onReset: () => void
}

export function JsonEditor({ value, onChange, error, onApply, onReset }: JsonEditorProps) {
  const lineCount = Math.max(12, value.split('\n').length)

  return (
    <div className="json-editor">
      <div className="json-editor-toolbar">
        <h3>Project JSON</h3>
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
        className={`json-textarea json-textarea-drawer ${error ? 'has-error' : ''}`}
        value={value}
        rows={lineCount}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />

      {error && <p className="error-message">{error}</p>}
    </div>
  )
}

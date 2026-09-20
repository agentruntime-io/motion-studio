import { useCallback, useState } from 'react'
import { SCHEMA_HELP } from '../lib/schemaHelp'

export function JsonSchemaReference() {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SCHEMA_HELP)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [])

  return (
    <div className="schema-reference">
      <details className="schema-help">
        <summary>JSON Schema Reference</summary>
        <pre>{SCHEMA_HELP}</pre>
      </details>
      <button
        type="button"
        className="btn btn-ghost btn-copy-schema"
        onClick={() => void handleCopy()}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

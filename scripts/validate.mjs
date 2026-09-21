import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const schemaPath = path.join(root, 'schema', 'motion-studio.schema.json')
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validate = ajv.compile(schema)

function formatPath(instancePath, missingProperty) {
  if (!instancePath && missingProperty) return missingProperty
  const base = instancePath.replace(/^\//, '').replace(/\//g, '.')
  if (missingProperty) return base ? `${base}.${missingProperty}` : missingProperty
  return base || '(root)'
}

function semanticIssues(project) {
  const issues = []
  const groups = []

  if (project.scenes?.length) {
    project.scenes.forEach((scene, index) => {
      groups.push({ prefix: `scenes[${index}].layers`, layers: scene.layers ?? [] })
    })
  } else if (project.layers) {
    groups.push({ prefix: 'layers', layers: project.layers })
  }

  for (const group of groups) {
    group.layers.forEach((layer, index) => {
      const layerPath = `${group.prefix}[${index}]`
      if (layer.duration <= 0) {
        issues.push(`${layerPath}.duration: must be > 0`)
      }
      if (layer.start < 0) {
        issues.push(`${layerPath}.start: must be >= 0`)
      }
      if (layer.type === 'video' && layer.trimEnd !== undefined && layer.trimEnd <= (layer.trimStart ?? 0)) {
        issues.push(`${layerPath}.trimEnd: must be greater than trimStart`)
      }
    })
  }

  return issues
}

function validateFile(filePath, expectValid) {
  const json = fs.readFileSync(filePath, 'utf8')
  let parsed
  try {
    parsed = JSON.parse(json)
  } catch {
    if (expectValid) {
      console.error(`FAIL ${path.relative(root, filePath)}: invalid JSON syntax`)
      return false
    }
    console.log(`OK  ${path.relative(root, filePath)}: invalid JSON (expected)`)
    return true
  }

  const schemaOk = validate(parsed)
  const semantic = semanticIssues(parsed)
  const valid = schemaOk && semantic.length === 0

  if (valid === expectValid) {
    console.log(`OK  ${path.relative(root, filePath)}`)
    return true
  }

  console.error(`FAIL ${path.relative(root, filePath)}`)
  if (!schemaOk) {
    for (const error of validate.errors ?? []) {
      console.error(`  ${formatPath(error.instancePath, error.params?.missingProperty)}: ${error.message}`)
    }
  }
  for (const issue of semantic) console.error(`  ${issue}`)
  return false
}

function runDir(dirName, expectValid) {
  const dir = path.join(root, 'fixtures', dirName)
  if (!fs.existsSync(dir)) return true
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.json'))
  return files.every((file) => validateFile(path.join(dir, file), expectValid))
}

let ok = true
ok = runDir('valid', true) && ok
ok = runDir('invalid', false) && ok

if (!ok) process.exit(1)
console.log('All fixture validations passed.')

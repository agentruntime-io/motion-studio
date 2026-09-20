import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import { defineConfig } from 'vite'

const PROJECTS_DIR = path.resolve(process.cwd(), 'projects')
const PROJECTS_URL_PREFIX = '/projects'

function normalizeApiProjectPath(projectPath: string): string {
  const normalized = projectPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalized) return ''
  if (normalized.startsWith('projects/') || normalized === 'projects') {
    return normalized === 'projects' ? '' : normalized.slice('projects/'.length)
  }
  return normalized
}

function getProjectJsonFilePath(projectPath: string): string {
  const relative = normalizeApiProjectPath(projectPath)
  if (!relative) {
    throw new Error('Invalid project path')
  }
  if (relative.includes('..')) {
    throw new Error('Invalid project path')
  }
  return path.join(PROJECTS_DIR, relative, 'project.json')
}

function listProjectFolderNames(): string[] {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true })
    return []
  }

  return fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `projects/${entry.name}`)
    .sort()
}

function readRequestBody(req: { on: (event: string, cb: (chunk: Buffer) => void) => void }): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function projectApiMiddleware(
  req: { method?: string; url?: string; on: (event: string, cb: (chunk: Buffer) => void) => void },
  res: {
    statusCode: number
    setHeader: (key: string, value: string) => void
    end: (body?: string) => void
  },
  next: () => void,
): void {
  const url = req.url?.split('?')[0] ?? ''

  if (url === '/api/projects' && req.method === 'GET') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(listProjectFolderNames()))
    return
  }

  if (url === '/api/project/save' && req.method === 'POST') {
    void (async () => {
      try {
        const raw = await readRequestBody(req)
        const body = JSON.parse(raw) as { projectPath?: string; json?: string }

        if (!body.projectPath || typeof body.json !== 'string') {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ message: 'Requires projectPath and json' }))
          return
        }

        const filePath = getProjectJsonFilePath(body.projectPath)
        fs.mkdirSync(path.dirname(filePath), { recursive: true })
        fs.writeFileSync(filePath, body.json, 'utf8')

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            path: filePath,
            relativePath: normalizeApiProjectPath(body.projectPath),
          }),
        )
      } catch (err) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            message: err instanceof Error ? err.message : 'Save failed',
          }),
        )
      }
    })()
    return
  }

  next()
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const types: Record<string, string> = {
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.json': 'application/json',
  }
  return types[ext] ?? 'application/octet-stream'
}

function serveProjectsMiddleware(
  req: { url?: string },
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: Buffer) => void },
  next: () => void,
): void {
  const url = req.url?.split('?')[0] ?? ''
  if (!url.startsWith(`${PROJECTS_URL_PREFIX}/`)) {
    next()
    return
  }

  const relative = decodeURIComponent(url.slice(PROJECTS_URL_PREFIX.length + 1))
  const filePath = path.resolve(PROJECTS_DIR, relative)
  const relativeToRoot = path.relative(PROJECTS_DIR, filePath)

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    res.statusCode = 403
    res.end()
    return
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.statusCode = 404
    res.end()
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', contentType(filePath))
  res.setHeader('Cache-Control', 'no-cache')
  res.end(fs.readFileSync(filePath))
}

function serveProjectsPlugin(): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(projectApiMiddleware)
    server.middlewares.use(serveProjectsMiddleware)
  }

  return {
    name: 'serve-projects',
    configureServer: attach,
    configurePreviewServer: attach,
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveProjectsPlugin()],
  define: {
    __WORKSPACE_ROOT__: JSON.stringify(process.cwd()),
  },
  server: {
    watch: {
      ignored: ['**/*.psd', '**/* - Copy.psd'],
    },
  },
})

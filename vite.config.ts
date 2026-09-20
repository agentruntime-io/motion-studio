import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import { defineConfig } from 'vite'

const PROJECTS_DIR = path.resolve(process.cwd(), 'projects')
const PROJECTS_URL_PREFIX = '/projects'

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
})

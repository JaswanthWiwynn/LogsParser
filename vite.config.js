import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fetchLogText } from './api/_lib/fetchLogText.js'

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function logFetchPlugin() {
  return {
    name: 'log-fetch',
    configureServer(server) {
      server.middlewares.use('/api/fetch-log', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Use POST' }))
          return
        }

        try {
          const body = JSON.parse((await readRequestBody(req)) || '{}')
          const url = String(body.url || '').trim()
          if (!url) throw new Error('Missing error link')
          const text = await fetchLogText(url)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ text }))
        } catch (error) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: error.message || 'Could not fetch log' }))
        }
      })
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss(), logFetchPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})

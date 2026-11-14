import dotenv from 'dotenv'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import http from 'node:http'
import https from 'node:https'
import { ensureSchema, insertParseRun, listParseRuns, pingDatabase } from './src/server/db.js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const MAX_LOG_BYTES = 8 * 1024 * 1024

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function fetchLogText(target, redirects = 0) {
  return new Promise((resolve, reject) => {
    let url
    try {
      url = new URL(target)
    } catch {
      reject(new Error('Error link is not a valid URL'))
      return
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      reject(new Error('Error link must start with http:// or https://'))
      return
    }

    const client = url.protocol === 'https:' ? https : http
    const request = client.request(
      url,
      {
        method: 'GET',
        rejectUnauthorized: false,
        headers: { 'User-Agent': 'LogsParser/1.0', Accept: '*/*' },
      },
      (response) => {
        const status = response.statusCode || 0
        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location && redirects < 5) {
          response.resume()
          const next = new URL(response.headers.location, url).href
          resolve(fetchLogText(next, redirects + 1))
          return
        }

        const chunks = []
        let size = 0
        response.on('data', (chunk) => {
          size += chunk.length
          if (size > MAX_LOG_BYTES) {
            request.destroy()
            reject(new Error('Log is larger than 8 MB and was stopped'))
            return
          }
          chunks.push(chunk)
        })
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          if (status >= 400) {
            reject(new Error(`HTTP ${status}`))
            return
          }
          resolve(text)
        })
      },
    )

    request.setTimeout(60000, () => {
      request.destroy(new Error('Timed out after 60 seconds'))
    })
    request.on('error', (error) => {
      if (error.message.startsWith('Log is larger')) {
        reject(error)
        return
      }
      reject(error)
    })
    request.end()
  })
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function apiPlugin() {
  return {
    name: 'logs-parser-api',
    configureServer(server) {
      let schemaReady = Promise.resolve()
      try {
        schemaReady = ensureSchema()
      } catch (error) {
        schemaReady = Promise.reject(error)
      }

      server.middlewares.use('/api/health', async (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { error: 'Use GET' })
          return
        }
        try {
          await schemaReady
          const ping = await pingDatabase()
          sendJson(res, 200, {
            ok: true,
            postgres: ping,
            branch: process.env.NEON_BRANCH || null,
          })
        } catch (error) {
          sendJson(res, 500, { ok: false, error: error.message || 'Database health check failed' })
        }
      })

      server.middlewares.use('/api/runs', async (req, res) => {
        try {
          await schemaReady
          if (req.method === 'GET') {
            const runs = await listParseRuns(20)
            sendJson(res, 200, { runs })
            return
          }
          if (req.method === 'POST') {
            const body = JSON.parse((await readRequestBody(req)) || '{}')
            const sourceFile = String(body.sourceFile || '').trim()
            if (!sourceFile) throw new Error('Missing sourceFile')
            const run = await insertParseRun({
              sourceFile,
              totalRows: Number(body.totalRows) || 0,
              failedRows: Number(body.failedRows) || 0,
              retrievedOk: Number(body.retrievedOk) || 0,
              retrievedError: Number(body.retrievedError) || 0,
            })
            sendJson(res, 201, { run })
            return
          }
          sendJson(res, 405, { error: 'Use GET or POST' })
        } catch (error) {
          sendJson(res, 400, { error: error.message || 'Runs API failed' })
        }
      })

      server.middlewares.use('/api/fetch-log', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Use POST' })
          return
        }

        try {
          const body = JSON.parse((await readRequestBody(req)) || '{}')
          const url = String(body.url || '').trim()
          if (!url) throw new Error('Missing error link')
          const text = await fetchLogText(url)
          sendJson(res, 200, { text })
        } catch (error) {
          sendJson(res, 400, { error: error.message || 'Could not fetch log' })
        }
      })
    },
  }
}

export default defineConfig({
  base: '/LogsParser/',
  plugins: [react(), tailwindcss(), apiPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})

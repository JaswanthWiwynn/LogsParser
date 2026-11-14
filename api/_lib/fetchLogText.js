import http from 'node:http'
import https from 'node:https'

const MAX_LOG_BYTES = 8 * 1024 * 1024

export function fetchLogText(target, redirects = 0) {
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

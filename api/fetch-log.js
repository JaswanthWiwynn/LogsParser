import { fetchLogText } from './_lib/fetchLogText.js'

export const config = {
  api: {
    bodyParser: true,
  },
  maxDuration: 60,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST' })
  }

  try {
    const url = String(req.body?.url || '').trim()
    if (!url) {
      return res.status(400).json({ error: 'Missing error link' })
    }
    const text = await fetchLogText(url)
    return res.status(200).json({ text })
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Could not fetch log' })
  }
}

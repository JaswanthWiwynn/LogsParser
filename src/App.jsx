import { useRef, useState } from 'react'
import AppNav from './components/AppNav'
import { formatLogs } from './lib/formatLogs'
import { parseSpreadsheet } from './lib/parseSheet'

async function fetchLogText(url) {
  const response = await fetch('/api/fetch-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || `Could not fetch log (${response.status})`)
  }
  return payload.text ?? ''
}

function downloadText(fileName, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const base = fileName.replace(/\.[^.]+$/, '') || 'failed_logs'
  link.href = url
  link.download = `${base}_failed_logs.txt`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function App() {
  const inputRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [summary, setSummary] = useState(null)
  const [entries, setEntries] = useState([])
  const [progress, setProgress] = useState(null)
  const [logText, setLogText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file) {
    if (!file || busy) return
    setBusy(true)
    setDragOver(false)
    setError('')
    setFileName(file.name)
    setSummary(null)
    setEntries([])
    setLogText('')
    setProgress({ current: 0, total: 0, serial: '' })

    try {
      const buffer = await file.arrayBuffer()
      const parsed = parseSpreadsheet(buffer)
      setSummary({ total: parsed.total, failed: parsed.failed.length, sheetName: parsed.sheetName })

      if (!parsed.failed.length) {
        setProgress(null)
        setError('No rows with result = failed were found.')
        return
      }

      const collected = []
      for (let index = 0; index < parsed.failed.length; index += 1) {
        const row = parsed.failed[index]
        setProgress({ current: index + 1, total: parsed.failed.length, serial: row.serialNum })

        let content = ''
        let ok = true
        if (!row.errorlink) {
          ok = false
          content = 'ERROR RETRIEVING LOG:\nThe errorlink cell is empty.'
        } else {
          try {
            content = await fetchLogText(row.errorlink)
          } catch (fetchError) {
            ok = false
            const detail = fetchError.message === 'Failed to fetch'
              ? 'Could not reach /api/fetch-log. Use the Vercel URL or run `npm run dev` locally.'
              : fetchError.message
            content = `ERROR RETRIEVING LOG:\n${detail}`
          }
        }

        collected.push({ ...row, content, ok })
        setEntries([...collected])
      }

      setLogText(formatLogs(file.name, collected))
      setProgress(null)
    } catch (parseError) {
      setProgress(null)
      setError(parseError.message || 'Could not read that spreadsheet.')
    } finally {
      setBusy(false)
    }
  }

  function openPicker() {
    if (!busy) inputRef.current?.click()
  }

  const fetchedCount = entries.filter((entry) => entry.ok).length
  const failedFetches = entries.length - fetchedCount
  const progressWidth = progress?.total ? (progress.current / progress.total) * 100 : 0

  return (
    <>
      <AppNav />
      <main className="mx-auto flex min-h-screen w-full max-w-[1120px] flex-col gap-6 px-4 pb-[max(4rem,env(safe-area-inset-bottom))] pt-8 sm:px-6 md:gap-8 md:px-8 md:pt-10 lg:px-10 lg:pt-14">
        <header className="flex flex-col gap-6 sm:gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="display mt-3">Logs Parser</h1>
            <p className="lede mt-4 sm:mt-5">
              Upload an Excel or CSV export. Rows where result is failed are opened from the errorlink
              column, then packed into one downloadable text file.
            </p>
          </div>
          <button type="button" onClick={openPicker} disabled={busy} className="btn btn-primary w-full shrink-0 md:w-auto">
            {busy ? 'Reading logs…' : 'Upload spreadsheet'}
          </button>
        </header>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            handleFile(file)
          }}
        />

        <section
          role="button"
          tabIndex={busy ? -1 : 0}
          aria-disabled={busy}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              openPicker()
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (!busy) setDragOver(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDragOver(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(false)
            handleFile(event.dataTransfer.files?.[0])
          }}
          className={`dropzone ${dragOver ? 'is-active' : ''}`}
        >
          <span className="mark" aria-hidden="true" />
          <p className="text-[17px] font-medium tracking-tight sm:text-xl">Drop a spreadsheet here</p>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">
            .xlsx, .xls, or .csv with columns result, errorlink, and serial_num
          </p>
          {fileName ? <p className="mt-5 font-mono text-[13px] text-accent break-all">{fileName}</p> : null}
        </section>

        {error ? (
          <p role="alert" className="alert rise">
            {error}
          </p>
        ) : null}

        {summary ? (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Rows in sheet" value={summary.total} />
            <Stat label="Failed rows" value={summary.failed} />
            <Stat label="Logs retrieved" value={entries.length ? `${fetchedCount} ok / ${failedFetches} errors` : '—'} />
          </section>
        ) : null}

        {progress ? (
          <section className="panel rise px-5 py-4 sm:px-6" aria-live="polite">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[15px]">
              <span>Fetching log {progress.current} of {progress.total}</span>
              {progress.serial ? (
                <span className="max-w-full min-w-0 font-mono text-[13px] break-all text-muted">{progress.serial}</span>
              ) : null}
            </div>
            <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressWidth)}>
              <div className="meter-bar" style={{ width: `${progressWidth}%` }} />
            </div>
          </section>
        ) : null}

        {entries.length ? (
          <section className="panel rise">
            <div className="flex flex-col gap-3 border-b border-black/6 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <h2 className="text-[17px] font-semibold tracking-tight">Failed rows</h2>
              <button
                type="button"
                disabled={!logText}
                onClick={() => downloadText(fileName, logText)}
                className="btn btn-primary w-full sm:w-auto"
              >
                Download txt
              </button>
            </div>

            <ul className="md:hidden">
              {entries.map((entry, index) => (
                <li key={`${entry.rowNumber}-${index}`} className="border-t border-black/6 px-5 py-4 first:border-t-0">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[15px] break-all">{entry.serialNum || '—'}</p>
                      <p className="mt-1 text-[15px] text-muted break-words">{entry.testCase || '—'}</p>
                    </div>
                    <Status ok={entry.ok} />
                  </div>
                  <p className="mt-2 text-[13px] text-faint">Row {index + 1}</p>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Serial</th>
                    <th>Test</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={`${entry.rowNumber}-${index}`}>
                      <td className="font-mono text-muted">{index + 1}</td>
                      <td className="font-mono whitespace-nowrap">{entry.serialNum || '—'}</td>
                      <td className="max-w-xs">{entry.testCase || '—'}</td>
                      <td>
                        <Status ok={entry.ok} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {logText ? (
          <section className="rise">
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight">Text file preview</h2>
            <pre className="preview">{logText}</pre>
          </section>
        ) : null}
      </main>
    </>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat rise">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </div>
  )
}

function Status({ ok }) {
  return (
    <span className={`${ok ? 'chip chip-ok' : 'chip chip-warn'} shrink-0`}>
      {ok ? 'Retrieved' : 'Saved with error'}
    </span>
  )
}

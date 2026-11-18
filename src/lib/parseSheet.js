import * as XLSX from 'xlsx'

const REQUIRED = ['result', 'errorlink', 'serial_num']

function normalize(value) {
  return String(value).trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function classifyResult(result) {
  const value = result.toLowerCase()
  if (value === 'failed') return 'failed'
  if (value === 'pass' || value === 'passed') return 'pass'
  return null
}

export function parseSpreadsheet(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('The workbook has no sheets.')
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: '',
    raw: false,
  })
  if (!rows.length) {
    throw new Error('The first sheet has no data rows.')
  }

  const headers = Object.keys(rows[0])
  const headerMap = new Map(headers.map((header) => [normalize(header), header]))
  const missing = REQUIRED.filter((name) => !headerMap.has(name))
  if (missing.length) {
    throw new Error(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`)
  }

  const parsed = rows.map((row, index) => {
    const result = String(row[headerMap.get('result')] ?? '').trim()
    return {
      rowNumber: index + 2,
      result,
      outcome: classifyResult(result),
      errorlink: String(row[headerMap.get('errorlink')] ?? '').trim(),
      serialNum: String(row[headerMap.get('serial_num')] ?? '').trim(),
      testCase: headerMap.has('test_case_name')
        ? String(row[headerMap.get('test_case_name')] ?? '').trim()
        : '',
    }
  })

  const selected = parsed.filter((row) => row.outcome === 'failed' || row.outcome === 'pass')
  const failed = selected.filter((row) => row.outcome === 'failed')
  const passed = selected.filter((row) => row.outcome === 'pass')

  return {
    sheetName,
    total: parsed.length,
    selected,
    failed,
    passed,
  }
}

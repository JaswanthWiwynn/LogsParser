export function formatLogs(fileName, entries) {
  const failedCount = entries.filter((entry) => entry.outcome === 'failed').length
  const passedCount = entries.filter((entry) => entry.outcome === 'pass').length

  const blocks = entries.map((entry, index) => {
    const resultLabel = entry.outcome === 'pass' ? 'PASS' : 'FAILED'
    return `log ${index + 1} from ${entry.serialNum || 'unknown'} [${resultLabel}]\n${entry.content}`
  })

  return [
    `SOURCE: ${fileName}`,
    `FAILED: ${failedCount}`,
    `PASSED: ${passedCount}`,
    `TOTAL LOGS: ${entries.length}`,
    '',
    blocks.join('\n-------------------\n'),
    '',
  ].join('\n')
}

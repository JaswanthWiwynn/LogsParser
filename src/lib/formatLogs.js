export function formatLogs(fileName, entries) {
  const blocks = entries.map((entry, index) => {
    return `log ${index + 1} from ${entry.serialNum || 'unknown'}\n${entry.content}`
  })

  return [`SOURCE: ${fileName}`, `FAILED LOGS: ${entries.length}`, '', blocks.join('\n-------------------\n'), ''].join('\n')
}

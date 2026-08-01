const MAX_SAFE_METRIC = Number.MAX_SAFE_INTEGER

export function normalizeSiteMonitor(data) {
  return {
    totalViews: normalizeMetric(data?.totalViews),
    totalVisitors: normalizeMetric(data?.totalVisitors),
    estimatedTransferBytes: normalizeMetric(data?.estimatedTransferBytes),
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : '',
  }
}

export function collectUnreportedTransferBytes(performanceApi, reportedEntries) {
  if (!performanceApi?.getEntriesByType || !(reportedEntries instanceof Set)) return 0

  const entries = [
    ...performanceApi.getEntriesByType('navigation'),
    ...performanceApi.getEntriesByType('resource'),
  ]
  let total = 0

  for (const entry of entries) {
    const key = `${entry.entryType || 'resource'}|${entry.name || ''}|${Number(entry.startTime) || 0}`
    if (reportedEntries.has(key)) continue
    reportedEntries.add(key)

    const bytes = Number(entry.transferSize)
    if (Number.isFinite(bytes) && bytes > 0) {
      total = Math.min(MAX_SAFE_METRIC, total + Math.floor(bytes))
    }
  }

  return total
}

export function formatSiteMetric(value, language = 'zh') {
  const locale = language === 'en' ? 'en-US' : 'zh-CN'
  return new Intl.NumberFormat(locale).format(normalizeMetric(value))
}

export function formatTransferBytes(value, language = 'zh') {
  const bytes = normalizeMetric(value)
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  if (bytes === 0) return '0 B'

  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const amount = bytes / (1024 ** unitIndex)
  const locale = language === 'en' ? 'en-US' : 'zh-CN'
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: amount >= 100 || unitIndex === 0 ? 0 : amount >= 10 ? 1 : 2,
  }).format(amount)} ${units[unitIndex]}`
}

function normalizeMetric(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 0
  return Math.min(MAX_SAFE_METRIC, Math.floor(number))
}

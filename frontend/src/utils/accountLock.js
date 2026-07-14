export function accountLockFromError(error, identifier, now = Date.now()) {
  if (error?.status !== 423 || error?.data?.code !== 'account_temporarily_banned') return null

  const serverTime = Date.parse(error.data.lockedUntil || '')
  const remaining = Number(error.data.remainingSeconds)
  const lockedUntil = Number.isFinite(serverTime)
    ? serverTime
    : now + Math.max(1, Number.isFinite(remaining) ? remaining : 60) * 1000
  const deadline = Number.isFinite(remaining) && remaining > 0
    ? now + remaining * 1000
    : lockedUntil

  return {
    identifier: normalizeLoginIdentifier(identifier),
    lockedUntil,
    deadline,
  }
}

export function accountLockRemaining(lock, now = Date.now()) {
  if (!lock || !Number.isFinite(lock.deadline)) return 0
  return Math.max(0, Math.ceil((lock.deadline - now) / 1000))
}

export function formatAccountLockRemaining(seconds) {
  const value = Math.max(0, Math.ceil(Number(seconds) || 0))
  const days = Math.floor(value / 86400)
  const hours = Math.floor((value % 86400) / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const remainder = value % 60
  if (days > 0) return `${days}天 ${hours}小时`
  if (hours > 0) return `${hours}小时 ${minutes}分钟`
  if (minutes > 0) return `${minutes}分 ${remainder}秒`
  return `${remainder}秒`
}

export function normalizeLoginIdentifier(value) {
  return String(value || '').trim().toLowerCase()
}

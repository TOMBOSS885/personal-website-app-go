import { describe, expect, it } from 'vitest'
import { accountLockFromError, accountLockRemaining, formatAccountLockRemaining } from './accountLock'

describe('account lock helpers', () => {
  it('parses the structured 423 response', () => {
    const now = Date.parse('2026-07-14T12:00:00Z')
    const lock = accountLockFromError({
      status: 423,
      data: {
        code: 'account_temporarily_banned',
        lockedUntil: '2026-07-15T12:00:00Z',
        remainingSeconds: 86400,
      },
    }, ' Reader@Example.com ', now)

    expect(lock.identifier).toBe('reader@example.com')
    expect(accountLockRemaining(lock, now)).toBe(86400)
  })

  it('ignores unrelated errors', () => {
    expect(accountLockFromError({ status: 401, data: {} }, 'reader')).toBeNull()
  })

  it('formats a compact countdown', () => {
    expect(formatAccountLockRemaining(90061)).toBe('1天 1小时')
    expect(formatAccountLockRemaining(125)).toBe('2分 5秒')
  })
})

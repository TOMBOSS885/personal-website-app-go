import { describe, expect, it } from 'vitest'
import { ApiError } from '../../shared/api/client'
import { accountLockFromError, accountLockRemaining, formatAccountLockRemaining } from './loginLock'

describe('desktop account lock helpers', () => {
  it('parses structured lock data from ApiError', () => {
    const now = Date.parse('2026-07-14T12:00:00Z')
    const error = new ApiError('locked', 423, undefined, {
      code: 'account_temporarily_banned',
      lockedUntil: '2026-07-15T12:00:00Z',
      remainingSeconds: 86400,
    })
    const lock = accountLockFromError(error, ' Reader ', now)

    expect(lock?.identifier).toBe('reader')
    expect(accountLockRemaining(lock, now)).toBe(86400)
  })

  it('ignores non-lock API errors', () => {
    expect(accountLockFromError(new ApiError('bad password', 401), 'reader')).toBeNull()
  })

  it('formats compact remaining time', () => {
    expect(formatAccountLockRemaining(3661)).toBe('1小时 1分钟')
  })
})

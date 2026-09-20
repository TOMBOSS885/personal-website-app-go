import { describe, expect, it } from 'vitest'
import {
  apiFailureError,
  formatTotpSecret,
  isTwoFactorRestartRequired,
  normalizeTotpCode,
  twoFactorMessage,
} from './twoFactor'

describe('two-factor helpers', () => {
  it('maps known error codes to Chinese messages', () => {
    expect(twoFactorMessage({ code: 'INVALID_TWO_FACTOR_CODE' }, 'fallback')).toBe('验证码不正确、已过期或已被使用')
    expect(twoFactorMessage({ code: 'UNKNOWN', message: 'server text' }, 'fallback')).toBe('server text')
    expect(twoFactorMessage({}, 'fallback')).toBe('fallback')
  })

  it('requires a fresh password login after a spent challenge', () => {
    expect(isTwoFactorRestartRequired('TWO_FACTOR_CHALLENGE_EXPIRED')).toBe(true)
    expect(isTwoFactorRestartRequired('INVALID_TWO_FACTOR_CODE')).toBe(false)
  })

  it('attaches the API code to thrown errors', () => {
    const error = apiFailureError({ code: 'TWO_FACTOR_SETUP_EXPIRED', message: 'expired' }, '绑定失败')
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('TWO_FACTOR_SETUP_EXPIRED')
    expect(error.message).toBe('绑定已过期，请重新开始')
  })

  it('normalizes authenticator codes and groups secrets', () => {
    expect(normalizeTotpCode('12a34 56')).toBe('123456')
    expect(normalizeTotpCode('123456789')).toBe('123456')
    expect(formatTotpSecret('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')).toBe('GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ')
  })
})

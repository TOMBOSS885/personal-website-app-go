export const TWO_FACTOR_MESSAGES = {
  INVALID_TWO_FACTOR_CODE: '验证码不正确、已过期或已被使用',
  TWO_FACTOR_CHALLENGE_EXPIRED: '二步验证已过期，请重新登录',
  TWO_FACTOR_CHALLENGE_LOCKED: '验证失败次数过多，请重新登录',
  TWO_FACTOR_CHALLENGE_INVALID: '登录验证已失效，请重新登录',
  TWO_FACTOR_SETUP_EXPIRED: '绑定已过期，请重新开始',
  TWO_FACTOR_ALREADY_ENABLED: '二步验证已经开启',
  TWO_FACTOR_NOT_ENABLED: '二步验证尚未开启',
  TWO_FACTOR_RATE_LIMITED: '二步验证尝试过于频繁，请稍后再试',
  INVALID_CURRENT_PASSWORD: '当前管理员密码不正确',
  TWO_FACTOR_CONFIGURATION_INVALID: '无法读取二步验证配置，请检查 setup_key',
  MIGRATION_REQUIRED: '请先导入数据库迁移 019_admin_totp.sql',
}

export const TWO_FACTOR_RESTART_CODES = [
  'TWO_FACTOR_CHALLENGE_EXPIRED',
  'TWO_FACTOR_CHALLENGE_LOCKED',
  'TWO_FACTOR_CHALLENGE_INVALID',
]

export function twoFactorMessage(data, fallback) {
  const code = typeof data === 'string' ? data : data?.code
  const message = typeof data === 'object' && data ? data.message : ''
  return TWO_FACTOR_MESSAGES[code] || message || fallback
}

export function isTwoFactorRestartRequired(code) {
  return TWO_FACTOR_RESTART_CODES.includes(String(code || ''))
}

export function apiFailureError(data, fallback) {
  const error = new Error(twoFactorMessage(data, fallback))
  error.code = data?.code || ''
  return error
}

export function normalizeTotpCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6)
}

export function formatTotpSecret(secret) {
  return String(secret || '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
}

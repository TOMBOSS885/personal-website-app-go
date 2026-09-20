import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const backend = relativePath => readFileSync(resolve(process.cwd(), `../php_backend/${relativePath}`), 'utf8')
const frontend = relativePath => readFileSync(resolve(process.cwd(), relativePath), 'utf8')

describe('administrator TOTP security contract', () => {
  const totp = backend('app/admin_totp.php')
  const bootstrap = backend('app/bootstrap.php')
  const migration = backend('migrations/019_admin_totp.sql')
  const settings = frontend('src/pages/admin/AccountSettings.jsx')
  const login = frontend('src/pages/admin/LoginPage.jsx')

  it('stores encrypted secrets and rejects reused time windows', () => {
    expect(totp).toContain("openssl_encrypt($secret, 'aes-256-gcm'")
    expect(totp).toContain('admin-totp-v1')
    expect(totp).toContain('$candidate <= $lastCounter')
    expect(totp).toContain('FOR UPDATE')
    expect(migration).toContain('totp_secret_encrypted')
    expect(migration).toContain('totp_enabled')
    expect(migration).toContain('totp_last_counter')
    expect(migration).toContain('totp_confirmed_at')
  })

  it('keeps pending login unauthenticated until the authenticator code succeeds', () => {
    expect(bootstrap).toContain("route === 'auth/two-factor'")
    expect(bootstrap).toContain('app_admin_totp_begin_pending_login')
    expect(bootstrap).toContain('requiresTwoFactor')
    expect(totp).toContain("$_SESSION['admin_totp_pending_id']")
    expect(totp).toContain('app_admin_complete_login')
    expect(totp).not.toMatch(/app_admin_totp_begin_pending_login[\s\S]{0,200}\$_SESSION\['admin_id'\]/)
  })

  it('requires a live authenticator code to disable two-factor authentication', () => {
    expect(totp).toContain('function app_admin_totp_disable')
    expect(totp).toContain('app_admin_totp_verify($secret, $code, $lastCounter)')
    expect(settings).toContain('handleTotpDisable')
    expect(settings).toContain('idPrefix="totp-disable"')
    expect(settings).toContain('关闭前请输入身份验证器当前的 6 位验证码')
  })

  it('exposes setup, confirm, disable and login challenge routes', () => {
    expect(bootstrap).toContain('admin/two-factor/status')
    expect(bootstrap).toContain('admin/two-factor/setup')
    expect(bootstrap).toContain('admin/two-factor/confirm')
    expect(bootstrap).toContain('admin/two-factor/disable')
    expect(settings).toContain('/api/admin/two-factor/setup')
    expect(settings).toContain('/api/admin/two-factor/confirm')
    expect(settings).toContain('/api/admin/two-factor/disable')
    expect(login).toContain("setLoginStep('two-factor')")
    expect(login).toContain('verifyTwoFactor')
  })
})

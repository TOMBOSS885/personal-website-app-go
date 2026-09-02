import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatAdminDate, oauthProviderName } from './UserManager'

describe('admin OAuth identity details', () => {
  it('uses readable provider names and safe date fallbacks', () => {
    expect(oauthProviderName('github')).toBe('GitHub')
    expect(oauthProviderName('qq')).toBe('QQ')
    expect(oauthProviderName('wechat')).toBe('微信')
    expect(formatAdminDate('not-a-date')).toBe('-')
    expect(formatAdminDate(null)).toBe('-')
  })

  it('renders the identity fields returned by the administrator API', () => {
    const frontend = readFileSync(new URL('./UserManager.jsx', import.meta.url), 'utf8')
    const backend = readFileSync(resolve(process.cwd(), '../php_backend/app/user_admin.php'), 'utf8')

    expect(frontend).toContain('user.oauthIdentities')
    expect(frontend).toContain('setSelectedUser(user)')
    expect(frontend).toContain('role="dialog"')
    expect(frontend).toContain('aria-label={`查看 ${user.email} 的第三方账号详情`}')
    expect(frontend).toContain('identity.providerSubject')
    expect(frontend).toContain('identity.providerUnionId')
    expect(frontend).toContain('identity.displayName')
    expect(frontend).toContain('identity.avatarUrl')
    expect(frontend).toContain('绑定时间')
    expect(frontend).toContain('最近登录')
    expect(frontend).toContain("event.key === 'Escape'")
    expect(backend).toContain("'oauthIdentities' => $oauthIdentities")
    expect(backend).toContain("'providerSubject'")
    expect(backend).toContain("'providerUnionId'")
    expect(backend).toMatch(/FROM oauth_identities WHERE user_id IN/)
  })
})

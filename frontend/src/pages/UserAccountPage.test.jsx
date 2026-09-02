import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./UserAccountPage.jsx', import.meta.url), 'utf8')

describe('third-party account binding UI contract', () => {
  it('requires password reauthentication and CSRF for bind and unbind', () => {
    expect(source).toContain("type=\"password\"")
    expect(source).toContain("'X-CSRF-Token': user?.csrfToken")
    expect(source).toContain('/bind-start`')
    expect(source).toContain('/unbind`')
  })

  it('checks the server-provided authorization destination before navigating', () => {
    expect(source).toContain('isAllowedOAuthAuthorizationUrl(bindTarget.provider, data.authorizationUrl)')
    expect(source).toContain('window.location.assign(data.authorizationUrl)')
  })
})

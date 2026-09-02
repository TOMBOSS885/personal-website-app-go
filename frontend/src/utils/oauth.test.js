import { describe, expect, it } from 'vitest'
import { isAllowedOAuthAuthorizationUrl, isSafeInternalPath, normalizeOAuthProviders, oauthFeedback, oauthStartUrl, withoutOAuthFeedback } from './oauth'

describe('OAuth frontend safety helpers', () => {
  it('allows only known providers and normalizes public flags', () => {
    expect(normalizeOAuthProviders([
      { provider: 'github', enabled: 1, configured: true },
      { provider: 'unknown', enabled: true, configured: true },
    ])).toEqual([{ provider: 'github', name: 'GitHub', enabled: true, configured: true }])
    expect(oauthStartUrl('unknown', 'login', '/')).toBe('')
  })

  it('does not forward absolute, backslash, or control-character redirects', () => {
    expect(isSafeInternalPath('/blog/42?tab=all')).toBe(true)
    expect(isSafeInternalPath('//evil.example')).toBe(false)
    expect(isSafeInternalPath('/\\evil.example')).toBe(false)
    expect(isSafeInternalPath('/blog\nnext')).toBe(false)
    expect(oauthStartUrl('github', 'login', '//evil.example')).not.toContain('return=')
  })

  it('maps known callback failures and never reflects unknown codes', () => {
    expect(oauthFeedback('?oauth=error&provider=github&code=OAUTH_NOT_BOUND')?.message).toContain('尚未绑定')
    const unknown = oauthFeedback('?oauth=error&provider=github&code=%3Cscript%3E')
    expect(unknown.message).not.toContain('<script>')
  })

  it('accepts authorization redirects only on each provider official host', () => {
    expect(isAllowedOAuthAuthorizationUrl('github', 'https://github.com/login/oauth/authorize?client_id=x')).toBe(true)
    expect(isAllowedOAuthAuthorizationUrl('github', 'https://github.com.evil.example/login')).toBe(false)
    expect(isAllowedOAuthAuthorizationUrl('github', 'http://github.com/login')).toBe(false)
    expect(isAllowedOAuthAuthorizationUrl('qq', 'https://graph.qq.com/oauth2.0/authorize')).toBe(true)
  })

  it('removes stale OAuth callback metadata before retrying', () => {
    expect(withoutOAuthFeedback('/blog/7?x=1&oauth=error&provider=github&code=failed')).toBe('/blog/7?x=1')
    expect(withoutOAuthFeedback('//evil.example')).toBe('/')
  })
})

import { Building2, Github, Globe2, MessageCircle, MessagesSquare } from 'lucide-react'

export const OAUTH_PROVIDERS = {
  github: { name: 'GitHub', icon: Github },
  qq: { name: 'QQ', icon: MessagesSquare },
  wechat: { name: '微信', icon: MessageCircle },
  google: { name: 'Google', icon: Globe2 },
  microsoft: { name: 'Microsoft', icon: Building2 },
}

export function normalizeOAuthProviders(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(item => item && OAUTH_PROVIDERS[item.provider])
    .map(item => ({
      provider: item.provider,
      name: item.name || OAUTH_PROVIDERS[item.provider].name,
      enabled: Boolean(item.enabled),
      configured: Boolean(item.configured),
    }))
}

export function oauthStartUrl(provider, intent, returnPath) {
  if (!OAUTH_PROVIDERS[provider]) return ''
  const params = new URLSearchParams({ intent: intent === 'bind' ? 'bind' : 'login' })
  if (isSafeInternalPath(returnPath)) {
    params.set('return', returnPath)
  }
  return `/api/auth/oauth/${provider}/start?${params.toString()}`
}

export function isSafeInternalPath(value) {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\')
    && !/[\u0000-\u001f\u007f]/.test(value)
}

const OAUTH_AUTHORIZATION_HOSTS = {
  github: new Set(['github.com']),
  qq: new Set(['graph.qq.com']),
  wechat: new Set(['open.weixin.qq.com']),
  google: new Set(['accounts.google.com']),
  microsoft: new Set(['login.microsoftonline.com']),
}

export function isAllowedOAuthAuthorizationUrl(provider, value) {
  try {
    const target = new URL(value)
    return target.protocol === 'https:' && Boolean(OAUTH_AUTHORIZATION_HOSTS[provider]?.has(target.hostname))
  } catch {
    return false
  }
}

export function withoutOAuthFeedback(value) {
  if (!isSafeInternalPath(value)) return '/'
  const target = new URL(value, 'https://local.invalid')
  target.searchParams.delete('oauth')
  target.searchParams.delete('provider')
  target.searchParams.delete('code')
  return `${target.pathname}${target.search}`
}

export function oauthFeedback(search) {
  const params = new URLSearchParams(search || '')
  const status = params.get('oauth')
  if (status !== 'success' && status !== 'error') return null
  const provider = params.get('provider')
  const providerName = OAUTH_PROVIDERS[provider]?.name || '第三方账号'
  const code = params.get('code') || ''
  if (status === 'success') return { type: 'success', message: `${providerName}操作成功。`, code }
  const messages = {
    OAUTH_NOT_BOUND: `该 ${providerName} 账号尚未绑定，请先使用 QQ 邮箱账号登录后进行绑定。`,
    OAUTH_DENIED: '你已取消第三方授权。',
    OAUTH_STATE_INVALID: '授权状态已过期或无效，请重新尝试。',
    OAUTH_IDENTITY_CONFLICT: `该 ${providerName} 账号已绑定其他站内账号。`,
    OAUTH_IDENTITY_ALREADY_BOUND: `该 ${providerName} 账号已绑定其他站内账号。`,
    OAUTH_BIND_SESSION_CHANGED: '登录会话已变更，为保护账号安全，请重新发起绑定。',
    OAUTH_ACCOUNT_UNAVAILABLE: '该站内账号当前无法登录。',
    OAUTH_PROVIDER_FAILED: `${providerName} 服务响应异常，本次操作未生效。`,
    OAUTH_PROVIDER_UNAVAILABLE: `${providerName} 暂时不可用，请稍后重试。`,
  }
  return { type: 'error', message: messages[code] || `${providerName}操作失败，请重新尝试。`, code }
}

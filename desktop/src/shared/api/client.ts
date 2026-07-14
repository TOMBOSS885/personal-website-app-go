import type {
  Article,
  CommentPage,
  DesktopLoginResponse,
  HomePayload,
  Language,
  MusicTrack,
  PageResponse,
  Project,
  PublicUser,
  PublicTheme,
  SearchResult,
} from './types'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  token?: string | null
}

export class ApiError extends Error {
  readonly status: number
  readonly requestId?: string

  constructor(message: string, status: number, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.requestId = requestId
  }
}

export function normalizeServerUrl(raw: string): string {
  const value = raw.trim()
  if (!value) throw new Error('请输入服务器地址')
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`
  const parsed = new URL(withProtocol)

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('服务器地址只支持 HTTP 或 HTTPS')
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('服务器地址不能包含账号、查询参数或锚点')
  }

  const path = parsed.pathname.replace(/\/+$/, '')
  return `${parsed.origin}${path === '/' ? '' : path}`
}

export function resolveServerUrl(serverUrl: string, value?: string | null): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^(data:|blob:)/i.test(trimmed)) return trimmed
  return new URL(trimmed, `${normalizeServerUrl(serverUrl)}/`).toString()
}

export function isSecureServerUrl(serverUrl: string): boolean {
  const url = new URL(normalizeServerUrl(serverUrl))
  return url.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
}

async function runtimeFetch(input: string, init: RequestInit): Promise<Response> {
  if (window.__TAURI_INTERNALS__) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    return tauriFetch(input, init)
  }
  return window.fetch(input, init)
}

async function requestJson<T>(serverUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = resolveServerUrl(serverUrl, path)
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-ID': crypto.randomUUID(),
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  let response: Response
  try {
    response = await runtimeFetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('无法连接服务器，请检查地址与网络', 0)
  }

  const requestId = response.headers.get('X-Request-ID') ?? undefined
  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String(payload.message)
      : `服务器返回 ${response.status}`
    throw new ApiError(message, response.status, requestId)
  }
  return payload as T
}

export const publicApi = {
  health: (serverUrl: string, signal?: AbortSignal) =>
    requestJson<unknown>(serverUrl, '/api/health', { signal }),
  home: (serverUrl: string, language: Language, signal?: AbortSignal) =>
    requestJson<HomePayload>(serverUrl, `/api/public/home?lang=${language}`, { signal }),
  articles: (
    serverUrl: string,
    params: { page: number; size?: number; q?: string; tag?: string; category?: string },
    signal?: AbortSignal,
  ) => {
    const query = new URLSearchParams({
      page: String(params.page),
      size: String(params.size ?? 10),
    })
    if (params.q) query.set('q', params.q)
    if (params.tag) query.set('tag', params.tag)
    if (params.category) query.set('category', params.category)
    return requestJson<PageResponse<Article>>(serverUrl, `/api/public/articles?${query}`, { signal })
  },
  article: (serverUrl: string, id: string | number, signal?: AbortSignal) =>
    requestJson<Article>(serverUrl, `/api/public/articles/${id}`, { signal }),
  unlockArticle: (serverUrl: string, id: string | number, password: string) =>
    requestJson<Article>(serverUrl, `/api/public/articles/${id}/unlock`, {
      method: 'POST',
      body: { password },
    }),
  comments: (serverUrl: string, id: string | number, page = 0, signal?: AbortSignal) =>
    requestJson<CommentPage>(serverUrl, `/api/public/articles/${id}/comments?page=${page}&size=20`, { signal }),
  projects: (serverUrl: string, signal?: AbortSignal) =>
    requestJson<Project[]>(serverUrl, '/api/public/projects', { signal }),
  categories: (serverUrl: string, signal?: AbortSignal) =>
    requestJson<string[] | null>(serverUrl, '/api/public/categories', { signal }),
  tags: (serverUrl: string, signal?: AbortSignal) =>
    requestJson<string[] | null>(serverUrl, '/api/public/tags', { signal }),
  search: (serverUrl: string, query: string, signal?: AbortSignal) =>
    requestJson<SearchResult[]>(serverUrl, `/api/public/search?q=${encodeURIComponent(query)}`, { signal }),
  theme: (serverUrl: string, signal?: AbortSignal) =>
    requestJson<PublicTheme>(serverUrl, '/api/public/theme', { signal }),
}

export const userApi = {
  desktopLogin: (serverUrl: string, identifier: string, password: string) =>
    requestJson<DesktopLoginResponse>(serverUrl, '/api/user-auth/desktop/login', {
      method: 'POST', body: { identifier: identifier.trim(), password },
    }),
  requestCode: (serverUrl: string, email: string, purpose: 'register' | 'reset') =>
    requestJson<{ message: string; expiresIn?: number; retryAfter?: number }>(serverUrl, '/api/user-auth/code', {
      method: 'POST', body: { email: email.trim(), purpose },
    }),
  register: (serverUrl: string, input: { email: string; code: string; username: string; password: string }) =>
    requestJson<PublicUser>(serverUrl, '/api/user-auth/register', {
      method: 'POST', body: { ...input, email: input.email.trim(), code: input.code.trim(), username: input.username.trim() },
    }),
  resetPassword: (serverUrl: string, input: { email: string; code: string; password: string }) =>
    requestJson<{ message: string }>(serverUrl, '/api/user-auth/password/reset', {
      method: 'POST', body: { ...input, email: input.email.trim(), code: input.code.trim() },
    }),
  me: (serverUrl: string, token: string, signal?: AbortSignal) =>
    requestJson<PublicUser>(serverUrl, '/api/account/me', { token, signal }),
  logout: (serverUrl: string, token: string) =>
    requestJson<{ message: string }>(serverUrl, '/api/account/logout', { method: 'POST', token }),
  updateUsername: (serverUrl: string, token: string, username: string) =>
    requestJson<PublicUser>(serverUrl, '/api/account/username', { method: 'PUT', token, body: { username: username.trim() } }),
  createComment: (serverUrl: string, token: string, input: { articleId: number; parentId?: number; content: string }) =>
    requestJson<CommentPage['comments'][number]>(serverUrl, '/api/user/comments', { method: 'POST', token, body: input }),
  updateComment: (serverUrl: string, token: string, id: number, content: string) =>
    requestJson<{ id: number; content: string; updatedAt: string }>(serverUrl, `/api/user/comments/${id}`, { method: 'PUT', token, body: { content } }),
  deleteComment: (serverUrl: string, token: string, id: number) =>
    requestJson<{ message: string }>(serverUrl, `/api/user/comments/${id}`, { method: 'DELETE', token }),
  music: (serverUrl: string, token: string, signal?: AbortSignal) =>
    requestJson<MusicTrack[]>(serverUrl, '/api/public/music', { token, signal }),
}

import { platformFetch } from '@shared/lib/platform'

export interface ApiErrorBody {
  code?: string
  message?: string
  error?: string
  requestId?: string
  fields?: Record<string, string>
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly requestId?: string
  readonly retryAfterSeconds?: number
  readonly fields?: Record<string, string>

  constructor(message: string, options: {
    status: number
    code?: string
    requestId?: string
    retryAfterSeconds?: number
    fields?: Record<string, string>
  }) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
    this.requestId = options.requestId
    this.retryAfterSeconds = options.retryAfterSeconds
    this.fields = options.fields
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  timeoutMs?: number
  auth?: boolean
  headers?: Record<string, string>
}

interface ApiClientOptions {
  getToken?: () => string | null
  onUnauthorized?: () => void
}

export class ApiClient {
  readonly origin: string
  private readonly getToken?: () => string | null
  private readonly onUnauthorized?: () => void

  constructor(origin: string, options: ApiClientOptions = {}) {
    this.origin = normalizeServerOrigin(origin)
    this.getToken = options.getToken
    this.onUnauthorized = options.onUnauthorized
  }

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000)
    const headers = new Headers(options.headers)
    const token = options.auth === false ? null : this.getToken?.()
    if (token) headers.set('Authorization', `Bearer ${token}`)

    let body: BodyInit | undefined
    if (options.body instanceof FormData || typeof options.body === 'string' || options.body instanceof Blob) {
      body = options.body
    } else if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }

    const onAbort = () => controller.abort()
    options.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      const response = await platformFetch(this.url(path), {
        method: options.method ?? 'GET',
        headers,
        body,
        signal: controller.signal,
      })
      const requestId = response.headers.get('X-Request-ID') ?? undefined
      if (!response.ok) {
        const payload = await parseError(response)
        if (response.status === 401 && options.auth !== false) this.onUnauthorized?.()
        throw new ApiError(payload.message || payload.error || defaultErrorMessage(response.status), {
          status: response.status,
          code: payload.code,
          requestId: payload.requestId || requestId,
          retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')),
          fields: payload.fields,
        })
      }
      if (response.status === 204) return undefined as T
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) return response.json() as Promise<T>
      return response.text() as Promise<T>
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (controller.signal.aborted) throw new ApiError('请求超时或已取消', { status: 0, code: 'REQUEST_ABORTED' })
      throw new ApiError(error instanceof Error ? error.message : '无法连接服务器', { status: 0, code: 'NETWORK_ERROR' })
    } finally {
      window.clearTimeout(timeout)
      options.signal?.removeEventListener('abort', onAbort)
    }
  }

  url(path: string): string {
    if (!path.startsWith('/')) throw new Error('API path 必须以 / 开头')
    return new URL(path, `${this.origin}/`).toString()
  }
}

export function normalizeServerOrigin(value: string): string {
  const input = value.trim()
  if (!input) throw new Error('请输入服务器地址')
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`
  const url = new URL(withProtocol)
  if (url.username || url.password || url.search || url.hash) throw new Error('服务器地址不能包含账号、查询参数或片段')
  if (url.pathname !== '/' && url.pathname !== '') throw new Error('服务器地址只能填写站点根地址')
  const isDevLoopback = import.meta.env.DEV && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !isDevLoopback) throw new Error('正式服务器必须使用 HTTPS')
  return url.origin
}

export function resolveAssetUrl(origin: string, value?: string | null): string {
  if (!value) return ''
  const url = new URL(value, `${normalizeServerOrigin(origin)}/`)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('资源地址协议无效')
  if (url.origin !== normalizeServerOrigin(origin)) throw new Error('拒绝加载其他服务器的资源')
  return url.toString()
}

async function parseError(response: Response): Promise<ApiErrorBody> {
  try {
    return await response.clone().json() as ApiErrorBody
  } catch {
    const text = await response.text().catch(() => '')
    return { message: text.slice(0, 300) }
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}

function defaultErrorMessage(status: number): string {
  if (status === 401) return '登录状态已失效'
  if (status === 403) return '当前账号无权执行此操作'
  if (status === 404) return '请求的资源不存在'
  if (status === 409) return '数据已在其他位置更新'
  if (status === 429) return '请求过于频繁，请稍后重试'
  if (status >= 500) return '服务器暂时不可用'
  return `请求失败（HTTP ${status}）`
}

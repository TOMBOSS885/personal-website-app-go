export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
  empty: boolean
}

export function normalizePage<T>(value: T[] | Partial<PageResponse<T>>, page = 0, size = 20): PageResponse<T> {
  const content = Array.isArray(value) ? value : Array.isArray(value.content) ? value.content : []
  const totalElements = Array.isArray(value) ? value.length : numberOr(value.totalElements, content.length)
  const normalizedSize = Math.max(1, Array.isArray(value) ? size : numberOr(value.size, size))
  const number = Math.max(0, Array.isArray(value) ? page : numberOr(value.number, page))
  const totalPages = Math.max(totalElements === 0 ? 0 : 1, Array.isArray(value) ? Math.ceil(totalElements / normalizedSize) : numberOr(value.totalPages, Math.ceil(totalElements / normalizedSize)))
  return {
    content,
    totalElements,
    totalPages,
    size: normalizedSize,
    number,
    first: number === 0,
    last: totalPages === 0 || number >= totalPages - 1,
    empty: content.length === 0,
  }
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

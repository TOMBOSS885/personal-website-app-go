import { describe, expect, it } from 'vitest'
import { getSharedHostTransport } from './adminFetch'

describe('getSharedHostTransport', () => {
  it('tunnels admin DELETE requests through POST', () => {
    expect(getSharedHostTransport('DELETE', true)).toEqual({
      method: 'POST',
      override: 'DELETE',
    })
  })

  it('keeps other requests unchanged', () => {
    expect(getSharedHostTransport('PUT', true)).toEqual({ method: 'PUT', override: '' })
    expect(getSharedHostTransport('DELETE', false)).toEqual({ method: 'DELETE', override: '' })
  })
})

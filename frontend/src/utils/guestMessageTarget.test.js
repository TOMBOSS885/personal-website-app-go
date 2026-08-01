import { describe, expect, it } from 'vitest'
import { guestbookTargetUrl, guestMessageTargetUrl, guestMessageUrl, messageIdFromHash, parseGuestbookTarget } from './guestMessageTarget'

describe('guest message target links', () => {
  it('builds internal article and project links', () => {
    expect(guestMessageTargetUrl({ type: 'article', id: 7 })).toBe('/blog/7')
    expect(guestMessageTargetUrl({ type: 'project', id: 4 })).toBe('/projects#project-4')
    expect(guestMessageTargetUrl({ type: 'other', id: 4 })).toBe('')
  })

  it('builds and parses exact guestbook links', () => {
    expect(guestMessageUrl(12)).toBe('/friends#message-12')
    expect(guestbookTargetUrl('article', 7)).toBe('/friends?targetType=article&targetId=7#guestbook')
    expect(parseGuestbookTarget('?targetType=project&targetId=3')).toEqual({ type: 'project', id: 3 })
    expect(messageIdFromHash('#message-12')).toBe(12)
  })

  it('rejects malformed ids', () => {
    expect(parseGuestbookTarget('?targetType=article&targetId=oops')).toBeNull()
    expect(messageIdFromHash('#message--1')).toBeNull()
    expect(guestMessageUrl('oops')).toBe('/friends#guestbook')
  })
})

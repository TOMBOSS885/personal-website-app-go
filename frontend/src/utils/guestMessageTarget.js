export function guestMessageTargetUrl(target) {
  const id = Number(target?.id)
  if (!Number.isInteger(id) || id < 1) return ''
  if (target?.type === 'article') return `/blog/${id}`
  if (target?.type === 'project') return `/projects#project-${id}`
  return ''
}

export function guestMessageUrl(messageId) {
  const id = Number(messageId)
  return Number.isInteger(id) && id > 0 ? `/friends#message-${id}` : '/friends#guestbook'
}

export function guestbookTargetUrl(type, targetId) {
  const id = Number(targetId)
  if (!['article', 'project'].includes(type) || !Number.isInteger(id) || id < 1) return '/friends#guestbook'
  return `/friends?targetType=${encodeURIComponent(type)}&targetId=${id}#guestbook`
}

export function parseGuestbookTarget(search) {
  const params = new URLSearchParams(search || '')
  const type = params.get('targetType') || ''
  const id = Number(params.get('targetId'))
  if (!['article', 'project'].includes(type) || !Number.isInteger(id) || id < 1) return null
  return { type, id }
}

export function messageIdFromHash(hash) {
  const match = /^#message-(\d+)$/.exec(hash || '')
  if (!match) return null
  const id = Number(match[1])
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

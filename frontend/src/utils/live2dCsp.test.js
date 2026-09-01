import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function extractLive2DInlineRuntime(source) {
  const marker = 't.append('
  const start = source.indexOf(marker)
  if (start < 0) return null

  const literalStart = start + marker.length
  const lfEnd = source.indexOf(');\nvar n', literalStart)
  const crlfEnd = source.indexOf(');\r\nvar n', literalStart)
  const literalEnd = lfEnd >= 0 ? lfEnd : crlfEnd
  if (literalEnd < 0) return null

  const literal = source.slice(literalStart, literalEnd)
  const jsonSafeLiteral = literal.replace(
    /[\u0000-\u001f]/g,
    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  )

  return JSON.parse(jsonSafeLiteral)
}

describe('Live2D content security policy', () => {
  it('allows only the exact inline runtime bundled by l2d-widget', () => {
    const live2dSource = readFileSync(resolve(process.cwd(), '../l2d-widget/dist/index.js'), 'utf8')
    const inlineRuntime = extractLive2DInlineRuntime(live2dSource)

    expect(inlineRuntime).toBeTruthy()

    const hash = createHash('sha256').update(inlineRuntime, 'utf8').digest('base64')
    const policies = [
      readFileSync(resolve(process.cwd(), '../docker/nginx.conf'), 'utf8'),
      readFileSync(resolve(process.cwd(), '../deploy/shared-host/.htaccess'), 'utf8'),
      readFileSync(resolve(process.cwd(), '../deploy/shared-host/nginx-rewrite.conf'), 'utf8'),
    ]

    for (const policy of policies) {
      expect(policy).toContain(`script-src 'self' 'sha256-${hash}'`)
      expect(policy).not.toContain("script-src 'self' 'unsafe-inline'")
      expect(policy).not.toContain("script-src 'self' 'unsafe-eval'")
    }
  })
})

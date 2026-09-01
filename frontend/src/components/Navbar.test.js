import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/components/Navbar.jsx'), 'utf8')

describe('navbar search entry', () => {
  it('keeps the original search page in the primary navigation', () => {
    const primaryLinks = source.slice(
      source.indexOf('const primaryNavLinks'),
      source.indexOf('const mobileNavLinks'),
    )

    expect(primaryLinks).toContain("path: '/search'")
    expect(source).toContain('const mobileNavLinks = primaryNavLinks')
    expect(source).not.toContain('CommandPalette')
    expect(source).not.toContain('setCommandOpen')
  })
})

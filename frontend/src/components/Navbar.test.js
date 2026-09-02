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

describe('navbar signed-in account menu', () => {
  it('keeps logout inside the signed-in menu and behind confirmation', () => {
    expect(source).toContain('aria-haspopup="menu"')
    expect(source).toContain('aria-expanded={accountMenuOpen}')
    expect(source).toContain('role="menuitem" onClick={requestLogout}')
    expect(source).toContain('setLogoutConfirmOpen(true)')
    expect(source).toContain('<LogoutConfirmDialog')
    expect(source).not.toContain('title="退出账号"')
  })
})

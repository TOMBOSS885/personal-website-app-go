import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function componentSource(fileName) {
  return readFileSync(resolve(process.cwd(), 'src/components', fileName), 'utf8')
}

describe('Live2D lifecycle', () => {
  it('only enables the model after the launcher is clicked', () => {
    const source = componentSource('Live2DController.jsx')

    expect(source).toContain('useState(false)')
    expect(source).toContain('onClick={() => setEnabled(true)}')
    expect(source).not.toMatch(/setTimeout\s*\([^)]*setEnabled\s*\(\s*true\s*\)/s)
    expect(source).not.toContain('setEnabled(false)')
  })

  it('does not recreate the WebGL widget when article compact mode changes', () => {
    const source = componentSource('Live2DWidget.jsx')

    expect(source).toContain("classList.toggle('live2d-compact', compact)")
    expect(source).toMatch(/classList\.toggle\('live2d-compact', compact\)[\s\S]*?}, \[compact\]\)/)
    expect(source).toContain('}, [position])')
    expect(source).not.toContain('}, [compact, position])')
  })
})

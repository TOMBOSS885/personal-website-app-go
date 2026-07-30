import { describe, expect, it } from 'vitest'
import { createLive2DSelection, normalizeLive2DPath } from './live2dImport'

describe('Live2D import paths', () => {
  it('normalizes separators and repeated slashes', () => {
    expect(normalizeLive2DPath('\\model\\textures//a.png')).toBe('model/textures/a.png')
  })

  it('strips the selected folder root and finds model entries', () => {
    const files = [
      { name: 'hero.model3.json', webkitRelativePath: 'hero/hero.model3.json', size: 100 },
      { name: 'hero.moc3', webkitRelativePath: 'hero/hero.moc3', size: 200 },
    ]
    const selection = createLive2DSelection(files)
    expect(selection.items.map(item => item.path)).toEqual(['hero.model3.json', 'hero.moc3'])
    expect(selection.entries).toEqual(['hero.model3.json'])
    expect(selection.sourceBytes).toBe(300)
  })
})

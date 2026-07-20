import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { describe, expect, it } from 'vitest'
import { remarkGithubAlerts, remarkSafeHtml } from './markdownPlugins'

function render(markdown) {
  return renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkSafeHtml, remarkGithubAlerts]}>
      {markdown}
    </ReactMarkdown>,
  )
}

describe('safe GitHub markdown extensions', () => {
  it('renders details and harmless inline tags while escaping unknown HTML', () => {
    const html = render([
      '<details open>',
      '<summary>More information</summary>',
      '',
      'Expanded **content**.',
      '</details>',
      '',
      'Press <kbd>Ctrl</kbd> + <kbd>K</kbd>.',
      '',
      '<script>alert(1)</script>',
    ].join('\n'))

    expect(html).toContain('<details open="">')
    expect(html).toContain('<summary>More information</summary>')
    expect(html).toContain('<strong>content</strong>')
    expect(html).toContain('<kbd>Ctrl</kbd>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('adds GitHub alert classes without allowing arbitrary attributes', () => {
    const html = render('> [!WARNING]\n> Be careful')
    expect(html).toContain('class="markdown-alert markdown-alert-warning"')
    expect(html).toContain('Be careful')
    expect(html).not.toContain('onclick')
  })

  it('keeps GFM tables, tasks, strike-through and footnotes enabled', () => {
    const html = render([
      '- [x] done',
      '',
      '| Name | Value |',
      '| --- | --- |',
      '| A | B |',
      '',
      '~~removed~~ and a footnote[^1]',
      '',
      '[^1]: Footnote text',
    ].join('\n'))

    expect(html).toContain('contains-task-list')
    expect(html).toContain('<table>')
    expect(html).toContain('<del>removed</del>')
    expect(html).toContain('class="footnotes"')
  })
})

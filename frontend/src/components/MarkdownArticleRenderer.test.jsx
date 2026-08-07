import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { describe, expect, it } from 'vitest'
import MarkdownArticleRenderer from './MarkdownArticleRenderer'

function render(markdown) {
  return renderToStaticMarkup(
    <MarkdownArticleRenderer content={markdown} resolveHeadingId={(_node, children) => String(children)} />,
  )
}

describe('article markdown presentation', () => {
  it('renders anchored headings and a single code block wrapper', () => {
    const html = render('## 安全配置\n\n```php\n<?php echo "ok";\n```')
    expect(html).toContain('class="article-heading-anchor"')
    expect(html).toContain('class="markdown-code-block"')
    expect(html).toContain('class="markdown-code-language">php')
    expect(html).not.toContain('<pre><div class="markdown-code-block">')
  })

  it('keeps single and double backtick content inline', () => {
    const html = render('Use `npm run build` and ``a value with ` inside`` in a paragraph.')
    expect(html).toContain('<code>npm run build</code>')
    expect(html).toContain('<code>a value with ` inside</code>')
    expect(html).not.toContain('markdown-code-block')
  })

  it('keeps image alt text accessible and exposes it as a caption', () => {
    const html = render('![首页截图](/uploads/home.webp)')
    expect(html).toContain('alt="首页截图"')
    expect(html).toContain('<figcaption>首页截图</figcaption>')
  })
  it('keeps Mermaid diagrams isolated from ordinary code blocks', () => {
    const html = render('```mermaid\nflowchart LR\n  A --> B\n```')
    expect(html).toContain('class="markdown-mermaid')
    expect(html).not.toContain('class="markdown-code-block"')
  })
})

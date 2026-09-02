import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { describe, expect, it } from 'vitest'
import MarkdownArticleRenderer, { getMermaidCacheKey, sanitizeMermaidSvg } from './MarkdownArticleRenderer'

function render(markdown) {
  return renderToStaticMarkup(
    <MarkdownArticleRenderer content={markdown} resolveHeadingId={(_node, children) => String(children)} />,
  )
}

describe('article markdown presentation', () => {
  it('rejects Mermaid output when an XML parser is unavailable', () => {
    expect(sanitizeMermaidSvg('<svg><rect /></svg>')).toBe('')
    expect(sanitizeMermaidSvg('<div>bad</div>')).toBe('')
  })
  it('uses a stable cache key for the same diagram and theme', () => {
    expect(getMermaidCacheKey('flowchart LR\nA --> B', 'light')).toBe('light:flowchart LR\nA --> B')
    expect(getMermaidCacheKey('flowchart LR\nA --> B', 'dark')).not.toBe(getMermaidCacheKey('flowchart LR\nA --> B', 'light'))
  })
  it('renders anchored headings and a single code block wrapper', () => {
    const html = render('## 安全配置\n\n```php\n<?php echo "ok";\n```')
    expect(html).toContain('class="article-heading-anchor"')
    expect(html).toContain('class="markdown-code-block"')
    expect(html).toContain('class="markdown-code-language">php')
    expect(html).not.toContain('<pre><div class="markdown-code-block">')
  })

  it('highlights broad language grammars and common fence aliases', () => {
    const html = render('```rust\nfn main() { println!("ok"); }\n```\n\n```c++\nstd::vector<int> values;\n```')
    expect(html).toContain('class="hljs language-rust"')
    expect(html).toContain('class="hljs-keyword"')
    expect(html).toContain('class="hljs language-c++"')
  })

  it('keeps single and double backtick content inline', () => {
    const html = render('Use `npm run build` and ``a value with ` inside`` in a paragraph.')
    expect(html).toContain('<code>npm run build</code>')
    expect(html).toContain('<code>a value with ` inside</code>')
    expect(html).not.toContain('markdown-code-block')
  })

  it('auto-detects unlabeled programming fences without affecting the wrapper', () => {
    const html = render('```\nconst answer = 42\n```')
    expect(html).toContain('class="markdown-code-block"')
    expect(html).toContain('class="hljs ')
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

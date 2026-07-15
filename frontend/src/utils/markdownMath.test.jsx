import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { describe, expect, it } from 'vitest'
import { KATEX_OPTIONS, normalizeMarkdownMath } from './markdownMath'

describe('web markdown math compatibility', () => {
  it('normalizes standard TeX delimiters without changing code', () => {
    const input = [
      String.raw`Inline \(E=mc^2\) and display:`,
      String.raw`\[`,
      String.raw`\frac{a}{b}`,
      String.raw`\]`,
      '',
      'Code: `\\(not math\\)`',
      '```md',
      String.raw`\[not math\]`,
      '```',
    ].join('\n')
    const normalized = normalizeMarkdownMath(input)

    expect(normalized).toContain('Inline $E=mc^2$')
    expect(normalized).toContain('$$\n\\frac{a}{b}\n$$')
    expect(normalized).toContain('`\\(not math\\)`')
    expect(normalized).toContain('```md\n\\[not math\\]\n```')
  })

  it('repairs legacy bracket equations while preserving source line numbers', () => {
    const input = String.raw`[
S/N(dB)
=======

10\log_{10}\frac SN
]

[
10\log_{10}1000
===============

# 10\times3

30\text{ dB}
]`
    const normalized = normalizeMarkdownMath(input)

    expect(normalized).toContain(String.raw`S/N(dB) = 10\log_{10}\frac SN`)
    expect(normalized).toContain(String.raw`10\log_{10}1000 = 10\times3 = 30\text{ dB}`)
    expect(normalized.split('\n')).toHaveLength(input.split('\n').length)
  })

  it('leaves ordinary bracket blocks unchanged and produces KaTeX markup', () => {
    expect(normalizeMarkdownMath('[\nordinary note\n]')).toBe('[\nordinary note\n]')

    const html = renderToStaticMarkup(
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}>
        {normalizeMarkdownMath('[\nn=\\log_2V\n]')}
      </ReactMarkdown>,
    )
    expect(html).toContain('katex-display')
    expect(html).toContain('katex-html')
  })
})

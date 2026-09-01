import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { describe, expect, it } from 'vitest'
import { KATEX_OPTIONS, normalizeMarkdownMath, remarkSingleLineDisplayMath } from './markdownMath'

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
      <ReactMarkdown remarkPlugins={[remarkMath, remarkSingleLineDisplayMath]} rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}>
        {normalizeMarkdownMath('[\nn=\\log_2V\n]')}
      </ReactMarkdown>,
    )
    expect(html).toContain('katex-display')
    expect(html).toContain('katex-html')
  })

  it('normalizes common parenthesized TeX without changing ordinary prose or code', () => {
    const input = [
      String.raw`(\varepsilon) and ({\varepsilon}) and (a\in\Sigma)`,
      'ordinary (a) text',
      'Code: `(a\\in\\Sigma)`',
    ].join('\n')
    const normalized = normalizeMarkdownMath(input)

    expect(normalized).toContain(String.raw`$\varepsilon$`)
    expect(normalized).toContain(String.raw`$a\in\Sigma$`)
    expect(normalized).toContain('ordinary (a) text')
    expect(normalized).toContain('`(a\\in\\Sigma)`')
  })

  it('does not reinterpret parentheses inside existing dollar-delimited math', () => {
    const input = [
      String.raw`   $$T_{IB}=20\times 1/(12\text{ MHz})=5/3\ \mu s$$`,
      '',
      '因此：',
      '',
      String.raw`   $$MIPS_B=1/(5/3\ \mu s)=0.6\text{ MIPS}$$`,
      '',
      String.raw`Inline $f(x)=\text{value}$ and legacy (a\in\Sigma).`,
    ].join('\n')
    const normalized = normalizeMarkdownMath(input)

    expect(normalized).toBe(input.replace(String.raw`legacy (a\in\Sigma)`, String.raw`legacy $a\in\Sigma$`))

    const html = renderToStaticMarkup(
      <ReactMarkdown remarkPlugins={[remarkMath, remarkSingleLineDisplayMath]} rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}>
        {normalized}
      </ReactMarkdown>,
    )
    expect(html.match(/katex-display/g)).toHaveLength(2)
    expect(html).not.toContain('katex-error')
  })

  it('protects the contents of multiline display math delimiters', () => {
    const dollarMath = String.raw`$$
f(x)=1/(2\text{ ms})
$$`
    const bracketMath = String.raw`\[
g(x)=1/(3\text{ ms})
\]`

    expect(normalizeMarkdownMath(dollarMath)).toBe(dollarMath)
    expect(normalizeMarkdownMath(bracketMath)).toBe(String.raw`$$
g(x)=1/(3\text{ ms})
$$`)
  })

  it('does not cascade legacy parentheses conversion inside standard TeX delimiters', () => {
    const input = [
      String.raw`\[CPI=\frac{\sum_{i=1}^{n}(CPI_i\times I_i)}{I_N}\]`,
      String.raw`\[T_{IB}=20\times 1/(12\text{ MHz})=5/3\ \mu s\]`,
      String.raw`\[MIPS_B=1/(5/3\ \mu s)=0.6\text{ MIPS}\]`,
    ].join('\n\n')
    const normalized = normalizeMarkdownMath(input)

    expect(normalized.match(/\$/g)).toHaveLength(12)
    expect(normalized).toContain(String.raw`$$T_{IB}=20\times 1/(12\text{ MHz})=5/3\ \mu s$$`)

    const html = renderToStaticMarkup(
      <ReactMarkdown remarkPlugins={[remarkMath, remarkSingleLineDisplayMath]} rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}>
        {normalized}
      </ReactMarkdown>,
    )
    expect(html.match(/katex-display/g)).toHaveLength(3)
    expect(html).not.toContain('katex-error')
  })
})

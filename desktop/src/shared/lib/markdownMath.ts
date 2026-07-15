const MAX_LEGACY_BLOCK_LINES = 50

export const KATEX_OPTIONS = Object.freeze({
  throwOnError: false,
  strict: 'ignore' as const,
  trust: false,
  maxExpand: 1000,
  maxSize: 50,
})

export function normalizeMarkdownMath(markdown = ''): string {
  const lines = String(markdown).split(/\r?\n/)
  const output: string[] = []
  let fence: { character: string; length: number } | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (!fence) fence = { character: marker[0], length: marker.length }
      else if (marker[0] === fence.character && marker.length >= fence.length) fence = null
      output.push(line)
      continue
    }
    if (fence) {
      output.push(line)
      continue
    }

    const trimmed = line.trim()
    if (trimmed === '\\[' || trimmed === '\\]') {
      output.push(`${leadingWhitespace(line)}$$`)
      continue
    }

    if (trimmed === '[') {
      const closingIndex = findLegacyBlockEnd(lines, index + 1)
      if (closingIndex > index) {
        const body = lines.slice(index + 1, closingIndex)
        if (looksLikeMath(body.join('\n'))) {
          const indentation = leadingWhitespace(line)
          output.push(`${indentation}$$`)
          output.push(`${indentation}${normalizeLegacyMathBody(body)}`)
          for (let offset = 1; offset < body.length; offset += 1) output.push('')
          output.push(`${indentation}$$`)
          index = closingIndex
          continue
        }
      }
    }

    const singleLineLegacy = /^\[\s*(.+?)\s*\]$/.exec(trimmed)
    if (singleLineLegacy && looksLikeMath(singleLineLegacy[1])) {
      output.push(`${leadingWhitespace(line)}$$${normalizeLegacyMathBody([singleLineLegacy[1]])}$$`)
      continue
    }

    output.push(replaceInlineDelimitersOutsideCode(line))
  }

  return output.join('\n')
}

function findLegacyBlockEnd(lines: string[], startIndex: number): number {
  const limit = Math.min(lines.length, startIndex + MAX_LEGACY_BLOCK_LINES)
  for (let index = startIndex; index < limit; index += 1) {
    if (/^\s*(`{3,}|~{3,})/.test(lines[index])) return -1
    if (lines[index].trim() === ']') return index
  }
  return -1
}

function looksLikeMath(value: string): boolean {
  return /\\[A-Za-z]+|[_^]\{?|\b(?:sin|cos|tan|log|ln|max|min)\b|[A-Za-z0-9)}]\s*[=<>±×÷]\s*[A-Za-z0-9({\\]/.test(value)
}

function normalizeLegacyMathBody(lines: string[]): string {
  const values = lines.map((line) => line.trim()).filter(Boolean)
  const output: string[] = []
  let previousWasHashEquation = false

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (/^={2,}$/.test(value)) {
      if (!/^#(?:\s|$)/.test(values[index + 1] ?? '')) output.push('=')
      previousWasHashEquation = false
      continue
    }
    if (/^#(?:\s|$)/.test(value)) {
      output.push(`= ${value.replace(/^#\s*/, '')}`)
      previousWasHashEquation = true
      continue
    }
    output.push(previousWasHashEquation && !/^[=<>+\-*/]/.test(value) ? `= ${value}` : value)
    previousWasHashEquation = false
  }

  return output.join(' ').replace(/\s+/g, ' ').trim()
}

function replaceInlineDelimitersOutsideCode(line: string): string {
  let cursor = 0
  let output = ''

  while (cursor < line.length) {
    const match = /`+/.exec(line.slice(cursor))
    if (!match) return output + replaceInlineDelimiters(line.slice(cursor))

    const openingIndex = cursor + match.index
    const marker = match[0]
    output += replaceInlineDelimiters(line.slice(cursor, openingIndex))
    const closingIndex = line.indexOf(marker, openingIndex + marker.length)
    if (closingIndex < 0) return output + line.slice(openingIndex)
    output += line.slice(openingIndex, closingIndex + marker.length)
    cursor = closingIndex + marker.length
  }

  return output
}

function replaceInlineDelimiters(value: string): string {
  return value
    .replace(/\\\[([^\n]+?)\\\]/g, (_match, formula: string) => `$$${formula}$$`)
    .replace(/\\\(([^\n]+?)\\\)/g, (_match, formula: string) => `$${formula}$`)
}

function leadingWhitespace(value: string): string {
  return /^\s*/.exec(value)?.[0] ?? ''
}

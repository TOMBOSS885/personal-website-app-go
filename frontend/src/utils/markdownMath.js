const MAX_LEGACY_BLOCK_LINES = 50

export const KATEX_OPTIONS = Object.freeze({
  throwOnError: false,
  strict: 'ignore',
  trust: false,
  maxExpand: 1000,
  maxSize: 50,
})

export function remarkSingleLineDisplayMath() {
  return (tree, file) => {
    promoteSingleLineDisplayMath(tree, String(file.value ?? ''))
  }
}

export function normalizeMarkdownMath(markdown = '') {
  const lines = String(markdown).split(/\r?\n/)
  const output = []
  let fence = null
  let displayMath = null

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
    if (displayMath === 'bracket') {
      if (trimmed === '\\]') {
        output.push(`${leadingWhitespace(line)}$$`)
        displayMath = null
      } else {
        output.push(line)
      }
      continue
    }

    if (displayMath === 'dollar') {
      const glued = splitGluedDisplayMathCloser(line)
      if (glued) {
        output.push(...glued.lines)
        displayMath = glued.displayMathOpen ? 'dollar' : null
        continue
      }
      const replacement = replaceInlineDelimitersOutsideCode(line, true)
      output.push(replacement.value)
      displayMath = replacement.displayMathOpen ? 'dollar' : null
      continue
    }

    if (trimmed === '\\[') {
      output.push(`${leadingWhitespace(line)}$$`)
      displayMath = 'bracket'
      continue
    }
    if (trimmed === '\\]') {
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

    const replacement = replaceInlineDelimitersOutsideCode(line)
    output.push(replacement.value)
    displayMath = replacement.displayMathOpen ? 'dollar' : null
  }

  return output.join('\n')
}

function findLegacyBlockEnd(lines, startIndex) {
  const limit = Math.min(lines.length, startIndex + MAX_LEGACY_BLOCK_LINES)
  for (let index = startIndex; index < limit; index += 1) {
    if (/^\s*(`{3,}|~{3,})/.test(lines[index])) return -1
    if (lines[index].trim() === ']') return index
  }
  return -1
}

function looksLikeMath(value) {
  return /\\[A-Za-z]+|[_^]\{?|\b(?:sin|cos|tan|log|ln|max|min)\b|[A-Za-z0-9)}]\s*[=<>±×÷]\s*[A-Za-z0-9({\\]/.test(value)
}

function normalizeLegacyMathBody(lines) {
  const values = lines.map((line) => line.trim()).filter(Boolean)
  const output = []
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

function replaceInlineDelimitersOutsideCode(line, displayMathOpen = false) {
  let cursor = 0
  let output = ''

  while (cursor < line.length) {
    if (displayMathOpen) {
      const closingIndex = findUnescapedDelimiter(line, '$$', cursor)
      if (closingIndex < 0) {
        return { value: output + line.slice(cursor), displayMathOpen: true }
      }
      output += line.slice(cursor, closingIndex + 2)
      cursor = closingIndex + 2
      displayMathOpen = false
      continue
    }

    const codeMatch = /`+/.exec(line.slice(cursor))
    const codeIndex = codeMatch ? cursor + codeMatch.index : -1
    const dollarIndex = findUnescapedDollar(line, cursor)
    const openingIndex = firstIndex(codeIndex, dollarIndex)
    if (openingIndex < 0) {
      return { value: output + replaceInlineDelimiters(line.slice(cursor)), displayMathOpen: false }
    }

    output += replaceInlineDelimiters(line.slice(cursor, openingIndex))

    if (openingIndex === codeIndex) {
      const marker = codeMatch[0]
      const closingIndex = line.indexOf(marker, openingIndex + marker.length)
      if (closingIndex < 0) {
        return { value: output + line.slice(openingIndex), displayMathOpen: false }
      }
      output += line.slice(openingIndex, closingIndex + marker.length)
      cursor = closingIndex + marker.length
      continue
    }

    const marker = line.startsWith('$$', openingIndex) ? '$$' : '$'
    const closingIndex = findUnescapedDelimiter(line, marker, openingIndex + marker.length)
    if (closingIndex < 0) {
      if (marker === '$$') {
        return { value: output + line.slice(openingIndex), displayMathOpen: true }
      }
      output += '$'
      cursor = openingIndex + 1
      continue
    }
    output += line.slice(openingIndex, closingIndex + marker.length)
    cursor = closingIndex + marker.length
  }

  return { value: output, displayMathOpen }
}

function blockquotePrefix(line) {
  return /^(?:\s*>\s?)*/.exec(line)?.[0] ?? ''
}

function isDisplayMathFenceLine(line) {
  return line.replace(/^(?:\s*>\s?)*/, '').trim() === '$$'
}

/**
 * micromark math-flow only closes on a line that *starts* with `$$`.
 * Notes often write `$$\nformula$$`, which leaves the fence open and causes
 * KaTeX to swallow the following Markdown as a red error.
 */
function splitGluedDisplayMathCloser(line) {
  if (isDisplayMathFenceLine(line)) return null

  const closingIndex = findUnescapedDelimiter(line, '$$', 0)
  if (closingIndex < 0) return null

  const quote = blockquotePrefix(line)
  const body = line.slice(0, closingIndex).replace(/[ \t]+$/, '')
  const rest = line.slice(closingIndex + 2).replace(/^[ \t]+/, '')
  const lines = []
  if (body.replace(/^(?:\s*>\s?)*/, '').trim() !== '') lines.push(body)
  lines.push(`${quote}$$`)
  if (rest === '') return { lines, displayMathOpen: false }

  const restLine = quote && !rest.startsWith(quote) ? `${quote}${rest}` : rest
  const replacement = replaceInlineDelimitersOutsideCode(restLine)
  lines.push(replacement.value)
  return { lines, displayMathOpen: replacement.displayMathOpen }
}

function findUnescapedDollar(value, startIndex) {
  for (let index = startIndex; index < value.length; index += 1) {
    if (value[index] === '$' && !isEscaped(value, index)) return index
  }
  return -1
}

function findUnescapedDelimiter(value, marker, startIndex) {
  for (let index = startIndex; index <= value.length - marker.length; index += 1) {
    if (!value.startsWith(marker, index) || isEscaped(value, index)) continue
    if (marker === '$' && (value[index - 1] === '$' || value[index + 1] === '$')) continue
    return index
  }
  return -1
}

function isEscaped(value, index) {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) slashCount += 1
  return slashCount % 2 === 1
}

function firstIndex(left, right) {
  if (left < 0) return right
  if (right < 0) return left
  return Math.min(left, right)
}

function promoteSingleLineDisplayMath(node, source) {
  if (!Array.isArray(node?.children)) return

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index]
    const formula = child?.type === 'paragraph' && child.children?.length === 1
      ? child.children[0]
      : null
    const start = child?.position?.start?.offset
    const end = child?.position?.end?.offset
    const original = Number.isInteger(start) && Number.isInteger(end)
      ? source.slice(start, end).trim()
      : ''

    if (formula?.type === 'inlineMath' && original.startsWith('$$') && original.endsWith('$$')) {
      node.children[index] = {
        type: 'math',
        meta: null,
        value: formula.value,
        data: {
          hName: 'pre',
          hChildren: [{
            type: 'element',
            tagName: 'code',
            properties: { className: ['language-math', 'math-display'] },
            children: [{ type: 'text', value: formula.value }],
          }],
        },
        position: child.position,
      }
      continue
    }

    promoteSingleLineDisplayMath(child, source)
  }
}

function replaceInlineDelimiters(value) {
  let cursor = 0
  let output = ''

  while (cursor < value.length) {
    const openingMatch = /\\[[(]/.exec(value.slice(cursor))
    if (!openingMatch) return output + replaceParenthesizedLegacyMath(value.slice(cursor))

    const openingIndex = cursor + openingMatch.index
    const openingMarker = openingMatch[0]
    const closingMarker = openingMarker === '\\[' ? '\\]' : '\\)'
    const closingIndex = value.indexOf(closingMarker, openingIndex + 2)
    if (closingIndex < 0) return output + replaceParenthesizedLegacyMath(value.slice(cursor))

    output += replaceParenthesizedLegacyMath(value.slice(cursor, openingIndex))
    const formula = value.slice(openingIndex + 2, closingIndex)
    output += openingMarker === '\\[' ? `$$${formula}$$` : `$${formula}$`
    cursor = closingIndex + 2
  }

  return output
}

function replaceParenthesizedLegacyMath(value) {
  return value.replace(
    /(^|[^\w!\\\]])\((?=[^()\n]{0,240}\\[A-Za-z]+)([^()\n]{1,240})\)/g,
    (_match, prefix, formula) => `${prefix}$${formula}$`,
  )
}

function leadingWhitespace(value) {
  return /^\s*/.exec(value)?.[0] ?? ''
}

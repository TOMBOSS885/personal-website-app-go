const SAFE_INLINE_TAGS = new Set(['kbd', 'mark', 'sub', 'sup', 'ins', 'del'])

/**
 * Converts a deliberately small, safe subset of raw HTML into mdast nodes.
 * ReactMarkdown escapes arbitrary HTML by default; this plugin only enables
 * GitHub-style details/summary and harmless inline typography tags.
 */
export function remarkSafeHtml() {
  return tree => {
    tree.children = transformChildren(tree.children || [])
  }
}

export function remarkGithubAlerts() {
  return tree => {
    visitBlocks(tree.children || [])
  }
}

function visitBlocks(nodes) {
  for (const node of nodes) {
    if (node.children) visitBlocks(node.children)
    if (node.type !== 'blockquote') continue

    const firstParagraph = node.children?.find(child => child.type === 'paragraph')
    const firstText = firstParagraph?.children?.find(child => child.type === 'text')
    const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(firstText?.value || '')
    if (!match) continue

    firstText.value = firstText.value.slice(match[0].length)
    node.data ||= {}
    node.data.hProperties ||= {}
    node.data.hProperties.className = ['markdown-alert', `markdown-alert-${match[1].toLowerCase()}`]
  }
}

function transformChildren(children) {
  const output = []
  const stack = []
  const inlineStack = []

  const append = node => {
    const parent = inlineStack[inlineStack.length - 1] || stack[stack.length - 1]
    if (parent) parent.children.push(node)
    else output.push(node)
  }

  for (const node of children) {
    if (node.type !== 'html') {
      if (node.children) node.children = transformChildren(node.children)
      append(node)
      continue
    }

    const value = String(node.value || '').trim()
    const detailsMatch = /^<details\b([^>]*)>([\s\S]*?)<\/details>$/i.exec(value)
    if (detailsMatch) {
      const details = createDetailsNode(detailsMatch[1])
      const inner = detailsMatch[2].trim()
      if (inner) {
        const parsed = parseInlineDetailsContent(inner)
        details.children.push(...parsed)
      }
      append(details)
      continue
    }

    const openWithSummary = /^<details\b([^>]*)>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>\s*$/i.exec(value)
    if (openWithSummary) {
      const details = createDetailsNode(openWithSummary[1])
      details.children.push(createSummaryNode(openWithSummary[2]))
      append(details)
      stack.push(details)
      continue
    }

    const openDetails = /^<details\b([^>]*)>$/i.exec(value)
    if (openDetails) {
      const details = createDetailsNode(openDetails[1])
      append(details)
      stack.push(details)
      continue
    }

    if (/^<\/details>$/i.test(value)) {
      if (stack.length) stack.pop()
      continue
    }

    const inlineOpen = /^<(kbd|mark|sub|sup|ins|del)\b[^>]*>$/i.exec(value)
    if (inlineOpen) {
      const inline = {
        type: 'safe-inline',
        children: [],
        data: { hName: inlineOpen[1].toLowerCase() },
      }
      append(inline)
      inlineStack.push(inline)
      continue
    }

    const inlineClose = /^<\/(kbd|mark|sub|sup|ins|del)>$/i.exec(value)
    if (inlineClose) {
      if (inlineStack.length) inlineStack.pop()
      continue
    }

    const summaryMatch = /^<summary\b[^>]*>([\s\S]*?)<\/summary>$/i.exec(value)
    if (summaryMatch && stack.length) {
      stack[stack.length - 1].children.push(createSummaryNode(summaryMatch[1]))
      continue
    }

    const inlineMatch = /^<(kbd|mark|sub|sup|ins|del)\b[^>]*>([\s\S]*?)<\/\1>$/i.exec(value)
    if (inlineMatch && SAFE_INLINE_TAGS.has(inlineMatch[1].toLowerCase())) {
      append({
        type: 'safe-inline',
        children: [{ type: 'text', value: decodeBasicEntities(inlineMatch[2]) }],
        data: { hName: inlineMatch[1].toLowerCase() },
      })
      continue
    }

    // Unknown HTML remains escaped by react-markdown.
    append(node)
  }

  return output
}

function createDetailsNode(attributes) {
  const open = /(?:^|\s)open(?:\s|=|$)/i.test(attributes)
  return {
    type: 'safe-details',
    children: [],
    data: {
      hName: 'details',
      hProperties: open ? { open: true } : {},
    },
  }
}

function createSummaryNode(value) {
  return {
    type: 'safe-summary',
    children: [{ type: 'text', value: decodeBasicEntities(value.trim()) }],
    data: { hName: 'summary' },
  }
}

function parseInlineDetailsContent(value) {
  const lines = value.split(/\r?\n/)
  const nodes = []
  let summaryConsumed = false
  let body = []

  for (const line of lines) {
    const summaryMatch = /^\s*<summary\b[^>]*>([\s\S]*?)<\/summary>\s*$/i.exec(line)
    if (!summaryConsumed && summaryMatch) {
      nodes.push(createSummaryNode(summaryMatch[1]))
      summaryConsumed = true
      continue
    }
    body.push(line)
  }

  const bodyText = body.join('\n').trim()
  if (bodyText) nodes.push({ type: 'paragraph', children: [{ type: 'text', value: bodyText }] })
  return nodes
}

function decodeBasicEntities(value) {
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

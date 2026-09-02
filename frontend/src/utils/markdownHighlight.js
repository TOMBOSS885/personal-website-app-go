import rehypeHighlight from 'rehype-highlight'
import { all } from 'lowlight'

// Register every grammar shipped by highlight.js.  The renderer still emits
// virtual HAST nodes, so no HTML from a source file is ever inserted into the
// document.  This keeps the broad language support of highlight.js while
// retaining rehype-highlight's safe rendering model.
const LANGUAGE_ALIASES = {
  javascript: ['js', 'jsx', 'node', 'nodejs'],
  typescript: ['ts', 'tsx'],
  python: ['py', 'gyp', 'ipython'],
  ruby: ['rb', 'gemspec', 'podspec'],
  rust: ['rs'],
  shell: ['sh', 'zsh', 'shellsession', 'console'],
  bash: ['csh'],
  yaml: ['yml'],
  xml: ['html', 'xhtml', 'rss', 'atom', 'xjb', 'xsd', 'xsl', 'plist', 'wsf'],
  markdown: ['md', 'mkdown', 'mkd'],
  plaintext: ['text', 'txt', 'plain'],
  cpp: ['c++', 'h++', 'hpp'],
  csharp: ['c#', 'cs', 'dotnet'],
  objectivec: ['mm', 'objc'],
  dockerfile: ['docker'],
  sql: ['mysql', 'pgsql', 'postgres', 'postgresql', 'plsql'],
  json: ['jsonc', 'geojson'],
  nginx: ['nginxconf'],
  latex: ['tex', 'context'],
}

// A labelled fence always uses its requested grammar.  For unlabeled fences,
// limit auto-detection to common programming languages to avoid turning prose
// into noisy, misleading token colours.
const DETECTION_SUBSET = [
  'bash', 'c', 'cpp', 'csharp', 'css', 'go', 'java', 'javascript', 'json',
  'kotlin', 'lua', 'php', 'python', 'ruby', 'rust', 'shell', 'sql', 'swift',
  'typescript', 'xml', 'yaml',
]

export const MARKDOWN_HIGHLIGHT_OPTIONS = {
  languages: all,
  aliases: LANGUAGE_ALIASES,
  detect: true,
  subset: DETECTION_SUBSET,
  // Mermaid is rendered by the dedicated diagram component after this
  // rehype pass; keeping it plain here avoids an unknown-language warning.
  plainText: ['text', 'txt', 'plaintext', 'plain', 'mermaid', 'no-highlight', 'nohighlight'],
}

// ReactMarkdown accepts a `[plugin, options]` tuple. Keeping the tuple here
// makes the article and editor preview identical while letting unified invoke
// the rehype attacher at processor setup time.
export const rehypeMarkdownHighlight = [rehypeHighlight, MARKDOWN_HIGHLIGHT_OPTIONS]

export function getMarkdownCodeLanguage(className) {
  const classes = String(className || '').split(/\s+/)
  const token = classes.find(value => value.startsWith('language-') || value.startsWith('lang-'))
  return token ? token.replace(/^(?:language|lang)-/i, '') : ''
}

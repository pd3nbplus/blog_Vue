import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import markdownItAnchor from 'markdown-it-anchor'

type HeadingItem = {
  level: number
  id: string
  title: string
}

const TOC_MARKER_PATTERN = /@?\[toc\]/gi
const TOC_PLACEHOLDER = 'BLOG_TOC_PLACEHOLDER_TOKEN'
const FENCED_CODE_BLOCK_PATTERN = /```[\s\S]*?```|~~~[\s\S]*?~~~/g

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
})

md.use(markdownItAnchor, {
  permalink: false,
  slugify: (title: string) =>
    title
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-'),
})

function normalizeTocMarkers(markdownContent: string): string {
  const content = markdownContent || ''
  const parts: string[] = []
  let cursor = 0
  for (const match of content.matchAll(FENCED_CODE_BLOCK_PATTERN)) {
    const start = match.index || 0
    const matched = match[0] || ''
    const end = start + matched.length
    if (start > cursor) {
      const plain = content.slice(cursor, start)
      parts.push(plain.replace(TOC_MARKER_PATTERN, `\n\n${TOC_PLACEHOLDER}\n\n`))
    }
    parts.push(matched)
    cursor = end
  }
  if (cursor < content.length) {
    parts.push(content.slice(cursor).replace(TOC_MARKER_PATTERN, `\n\n${TOC_PLACEHOLDER}\n\n`))
  }
  return parts.join('')
}

function normalizeBlockMathMarkers(content: string): string {
  const lines = content.split('\n')
  const normalized: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i] || ''
    if (current.trim() !== '$$') {
      normalized.push(current)
      continue
    }

    let closingIndex = -1
    for (let j = i + 1; j < lines.length; j += 1) {
      if ((lines[j] || '').trim() === '$$') {
        closingIndex = j
        break
      }
    }

    if (closingIndex === -1) {
      normalized.push(current)
      continue
    }

    const blockContent = lines
      .slice(i + 1, closingIndex)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    normalized.push(`$$${blockContent}$$`)
    i = closingIndex
  }

  return normalized.join('\n')
}

function normalizeMathDelimiters(content: string): string {
  if (!content) return content
  // Legacy imports may escape math block delimiters as \$$, which breaks KaTeX auto-render.
  return content.replace(/\\\$\$/g, () => '$$')
}

function normalizeMathBlocksOutsideCode(markdownContent: string): string {
  const content = markdownContent || ''
  const parts: string[] = []
  let cursor = 0

  for (const match of content.matchAll(FENCED_CODE_BLOCK_PATTERN)) {
    const start = match.index || 0
    const matched = match[0] || ''
    const end = start + matched.length

    if (start > cursor) {
      const plain = normalizeMathDelimiters(content.slice(cursor, start))
      parts.push(normalizeBlockMathMarkers(plain))
    }
    parts.push(matched)
    cursor = end
  }

  if (cursor < content.length) {
    const plain = normalizeMathDelimiters(content.slice(cursor))
    parts.push(normalizeBlockMathMarkers(plain))
  }

  return parts.join('')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type InlineNode = {
  type?: string
  content?: string
  children?: InlineNode[] | null
}

function flattenInlineText(nodes?: InlineNode[] | null): string {
  if (!nodes?.length) return ''
  return nodes
    .map((node) => {
      if (!node) return ''
      if (node.type === 'text' || node.type === 'code_inline' || node.type === 'image') {
        return node.content || ''
      }
      if (node.children) {
        return flattenInlineText(node.children)
      }
      return ''
    })
    .join('')
}

function headingPlainText(inlineToken: { content?: string; children?: InlineNode[] | null }): string {
  const extracted = flattenInlineText(inlineToken.children).trim()
  if (extracted) return extracted.replace(/\s+/g, ' ')
  return (inlineToken.content || '').trim().replace(/\s+/g, ' ')
}

function collectHeadings(tokens: ReturnType<typeof md.parse>): HeadingItem[] {
  const headings: HeadingItem[] = []
  let serial = 0

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (!token) continue
    if (token.type !== 'heading_open') continue

    const level = Number(token.tag.replace('h', ''))
    const inlineToken = tokens[i + 1]
    if (!inlineToken || inlineToken.type !== 'inline') continue

    const title = headingPlainText(inlineToken)
    if (!title) continue

    const id = token.attrGet('id') || `toc-${serial}`
    token.attrSet('id', id)
    headings.push({ level, id, title })
    serial += 1
  }

  return headings
}

function buildTocHtml(headings: HeadingItem[]): string {
  if (!headings.length) return ''

  const segments: string[] = ['<div class="toc">']
  let currentLevel = 0

  headings.forEach((heading, index) => {
    const targetLevel = Math.max(1, heading.level)

    while (currentLevel < targetLevel) {
      segments.push('<ul>')
      currentLevel += 1
    }

    while (currentLevel > targetLevel) {
      segments.push('</li></ul>')
      currentLevel -= 1
    }

    if (index > 0) {
      segments.push('</li>')
    }

    segments.push(`<li><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.title)}</a>`)
  })

  while (currentLevel > 0) {
    segments.push('</li></ul>')
    currentLevel -= 1
  }

  segments.push('</div>')
  return segments.join('')
}

function injectInlineToc(html: string, tocHtml: string): string {
  if (!html.includes(TOC_PLACEHOLDER)) return html
  if (!tocHtml) {
    return html.replace(new RegExp(`<p>\\s*${TOC_PLACEHOLDER}\\s*</p>`, 'g'), '').replace(new RegExp(TOC_PLACEHOLDER, 'g'), '')
  }
  return html
    .replace(new RegExp(`<p>\\s*${TOC_PLACEHOLDER}\\s*</p>`, 'g'), tocHtml)
    .replace(new RegExp(TOC_PLACEHOLDER, 'g'), tocHtml)
}

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'a',
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'code',
      'pre',
      'blockquote',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'hr',
      'strong',
      'em',
      'span',
      'div',
      'br',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel', 'loading', 'referrerpolicy'],
  })
}

export function renderMarkdownContent(markdownContent: string): { html: string; tocHtml: string } {
  const normalizedToc = normalizeTocMarkers(markdownContent || '')
  const normalized = normalizeMathBlocksOutsideCode(normalizedToc)
  const tokens = md.parse(normalized, {})
  const headings = collectHeadings(tokens)
  const tocHtmlRaw = buildTocHtml(headings)
  const renderedRaw = md.renderer.render(tokens, md.options, {})
  const renderedWithInlineToc = injectInlineToc(renderedRaw, tocHtmlRaw)

  return {
    html: sanitize(renderedWithInlineToc),
    tocHtml: sanitize(tocHtmlRaw),
  }
}

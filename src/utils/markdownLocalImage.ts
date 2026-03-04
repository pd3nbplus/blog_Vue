const HTML_IMAGE_REF_PATTERN = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
const FENCED_CODE_BLOCK_PATTERN = /```[\s\S]*?```|~~~[\s\S]*?~~~/g

function stripFencedCodeBlocks(content: string): string {
  return content.replace(FENCED_CODE_BLOCK_PATTERN, '')
}

function normalizeImageRef(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (value.startsWith('<') && value.includes('>')) {
    return value.slice(1, value.indexOf('>')).trim()
  }
  if (value.includes(' ')) {
    const [pathPart = ''] = value.split(' ', 1)
    return pathPart.trim()
  }
  return value
}

function isLocalImageRef(src: string): boolean {
  const value = src.trim().toLowerCase()
  if (!value) return false
  if (value.startsWith('http://') || value.startsWith('https://')) return false
  if (value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('#')) return false
  if (value.startsWith('/static/') || value.startsWith('/media/')) return false
  if (value.startsWith('/')) return false
  return true
}

function findClosingParen(text: string, start: number): number {
  let depth = 1
  let idx = start
  let inSingle = false
  let inDouble = false

  while (idx < text.length) {
    const char = text[idx]
    if (char === '\\') {
      idx += 2
      continue
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (char === '"' && !inSingle) {
      inDouble = !inDouble
    } else if (!inSingle && !inDouble) {
      if (char === '(') {
        depth += 1
      } else if (char === ')') {
        depth -= 1
        if (depth === 0) return idx
      }
    }
    idx += 1
  }

  return -1
}

export function extractLocalImageRefs(markdownContent: string): string[] {
  const content = stripFencedCodeBlocks(markdownContent || '')
  const refs: string[] = []
  const seen = new Set<string>()
  let cursor = 0

  while (cursor < content.length) {
    const marker = content.indexOf('![', cursor)
    if (marker < 0) break
    const linkOpen = content.indexOf('](', marker + 2)
    if (linkOpen < 0) break
    const destStart = linkOpen + 2
    const destEnd = findClosingParen(content, destStart)
    if (destEnd < 0) {
      cursor = linkOpen + 2
      continue
    }

    const rawDestination = content.slice(destStart, destEnd)
    const normalized = normalizeImageRef(rawDestination)
    if (normalized && isLocalImageRef(normalized) && !seen.has(normalized)) {
      seen.add(normalized)
      refs.push(normalized)
    }
    cursor = destEnd + 1
  }

  for (const match of content.matchAll(HTML_IMAGE_REF_PATTERN)) {
    const normalized = normalizeImageRef(match[1] || '')
    if (!normalized || !isLocalImageRef(normalized) || seen.has(normalized)) continue
    seen.add(normalized)
    refs.push(normalized)
  }

  return refs
}

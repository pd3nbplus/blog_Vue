import type { LocalImageUploadMapping } from '@/services/api/adminArticle'

type MatchStatus = 'matched' | 'unmatched' | 'ambiguous'
type MatchStrategy = 'path' | 'filename'

export interface LocalImageMatchPreviewItem {
  ref: string
  status: MatchStatus
  strategy?: MatchStrategy
  matchedFileName?: string
  matchedFileDisplay?: string
  candidateDisplays?: string[]
}

export interface LocalImageMatchResult {
  mappings: LocalImageUploadMapping[]
  unmatchedRefs: string[]
  ambiguousRefs: string[]
  previews: LocalImageMatchPreviewItem[]
}

interface FileCandidate {
  file: File
  display: string
  nameKey: string
  pathKeys: string[]
}

function normalizePath(value: string): string {
  return (value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^[./]+/, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/[?#].*$/, '')
    .toLowerCase()
}

function getBasename(pathValue: string): string {
  const normalized = normalizePath(pathValue)
  const parts = normalized.split('/').filter(Boolean)
  return parts.pop() || ''
}

function collectPathKeys(pathValue: string): string[] {
  const normalized = normalizePath(pathValue)
  if (!normalized) return []
  const segments = normalized.split('/').filter(Boolean)
  const keys = new Set<string>()
  for (let i = 0; i < segments.length; i += 1) {
    keys.add(segments.slice(i).join('/'))
  }
  return Array.from(keys)
}

function buildFileCandidates(files: File[]): FileCandidate[] {
  return files.map((file) => {
    const relative = (file.webkitRelativePath || '').trim()
    const display = relative || file.name
    const pathKeys = collectPathKeys(relative)
    return {
      file,
      display,
      nameKey: normalizePath(file.name),
      pathKeys,
    }
  })
}

function uniqueByFileIdentity(files: File[]): File[] {
  const map = new Map<string, File>()
  files.forEach((file) => {
    const key = [file.name, file.size, file.lastModified, file.webkitRelativePath || ''].join('::')
    if (!map.has(key)) {
      map.set(key, file)
    }
  })
  return Array.from(map.values())
}

export function mergeLocalImageFiles(existing: File[], incoming: File[]): File[] {
  return uniqueByFileIdentity([...existing, ...incoming])
}

export function matchLocalImageRefs(refs: string[], files: File[]): LocalImageMatchResult {
  const candidates = buildFileCandidates(files)
  const byPath = new Map<string, FileCandidate[]>()
  const byName = new Map<string, FileCandidate[]>()

  candidates.forEach((candidate) => {
    const nameList = byName.get(candidate.nameKey) || []
    nameList.push(candidate)
    byName.set(candidate.nameKey, nameList)

    candidate.pathKeys.forEach((pathKey) => {
      const list = byPath.get(pathKey) || []
      list.push(candidate)
      byPath.set(pathKey, list)
    })
  })

  const mappings: LocalImageUploadMapping[] = []
  const unmatchedRefs: string[] = []
  const ambiguousRefs: string[] = []
  const previews: LocalImageMatchPreviewItem[] = []

  refs.forEach((ref) => {
    const refPathKey = normalizePath(ref)
    const pathMatches = refPathKey ? byPath.get(refPathKey) || [] : []
    if (pathMatches.length === 1) {
      const matched = pathMatches[0]
      if (!matched) {
        unmatchedRefs.push(ref)
        previews.push({ ref, status: 'unmatched' })
        return
      }
      mappings.push({ ref, file: matched.file })
      previews.push({
        ref,
        status: 'matched',
        strategy: 'path',
        matchedFileName: matched.file.name,
        matchedFileDisplay: matched.display,
      })
      return
    }
    if (pathMatches.length > 1) {
      ambiguousRefs.push(ref)
      previews.push({
        ref,
        status: 'ambiguous',
        strategy: 'path',
        candidateDisplays: pathMatches.map((item) => item.display),
      })
      return
    }

    const baseName = getBasename(refPathKey)
    const nameMatches = baseName ? byName.get(baseName) || [] : []
    if (nameMatches.length === 1) {
      const matched = nameMatches[0]
      if (!matched) {
        unmatchedRefs.push(ref)
        previews.push({ ref, status: 'unmatched' })
        return
      }
      mappings.push({ ref, file: matched.file })
      previews.push({
        ref,
        status: 'matched',
        strategy: 'filename',
        matchedFileName: matched.file.name,
        matchedFileDisplay: matched.display,
      })
      return
    }
    if (nameMatches.length > 1) {
      ambiguousRefs.push(ref)
      previews.push({
        ref,
        status: 'ambiguous',
        strategy: 'filename',
        candidateDisplays: nameMatches.map((item) => item.display),
      })
      return
    }

    unmatchedRefs.push(ref)
    previews.push({
      ref,
      status: 'unmatched',
    })
  })

  return {
    mappings,
    unmatchedRefs,
    ambiguousRefs,
    previews,
  }
}

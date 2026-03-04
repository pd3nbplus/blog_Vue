import type { AdminMediaFileItem } from '@/types/admin'

export type ViewMode = 'icon' | 'list' | 'column' | 'gallery'

export const MEDIA_VIEW_MODE_STORAGE_KEY = 'admin-media:view-mode'
export const MEDIA_UPLOAD_MAX_BYTES = 5 * 1024 * 1024

export interface ExplorerDirectoryEntry {
  kind: 'directory'
  name: string
  path: string
}

export interface ExplorerFileEntry extends AdminMediaFileItem {
  kind: 'file'
  path: string
}

export type ExplorerEntry = ExplorerDirectoryEntry | ExplorerFileEntry

export interface DirectoryTreeRow {
  path: string
  name: string
  depth: number
  expanded: boolean
  hasChildren: boolean
  loaded: boolean
  loadingChildren: boolean
  isCurrent: boolean
}

export interface PendingUploadFile {
  uid: string
  file: File
}

export function isViewMode(value: string): value is ViewMode {
  return value === 'icon' || value === 'list' || value === 'column' || value === 'gallery'
}

export function loadSavedViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'icon'
  try {
    const saved = window.localStorage.getItem(MEDIA_VIEW_MODE_STORAGE_KEY)
    if (saved && isViewMode(saved)) return saved
  } catch {
    return 'icon'
  }
  return 'icon'
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

export function buildUploadUid(file: File & { uid?: string }): string {
  const rawUid = typeof file.uid === 'string' ? file.uid : ''
  if (rawUid) return rawUid
  return `${file.name}-${file.size}-${file.lastModified}`
}

export function pathToSegments(path: string): string[] {
  return normalizePath(path)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

export function joinPath(parent: string, child: string): string {
  const normalizedParent = normalizePath(parent)
  const normalizedChild = normalizePath(child)
  if (!normalizedParent) return normalizedChild
  if (!normalizedChild) return normalizedParent
  return `${normalizedParent}/${normalizedChild}`
}

export function getPathName(path: string): string {
  const segments = pathToSegments(path)
  return segments[segments.length - 1] || 'static'
}

export function buildPathChain(path: string): string[] {
  const segments = pathToSegments(path)
  const chain = ['']
  for (let index = 0; index < segments.length; index += 1) {
    chain.push(segments.slice(0, index + 1).join('/'))
  }
  return chain
}

export function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let next = size
  let unitIndex = 0
  while (next >= 1024 && unitIndex < units.length - 1) {
    next /= 1024
    unitIndex += 1
  }
  return `${next.toFixed(next >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

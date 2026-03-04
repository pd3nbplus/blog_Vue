import { API_BASE_URL } from '@/config/env'

function detectBackendOrigin(): string {
  try {
    return new URL(API_BASE_URL).origin
  } catch {
    if (typeof window !== 'undefined') return window.location.origin
    return ''
  }
}

export const BACKEND_ORIGIN = detectBackendOrigin()

export function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '')
}

export function resolveTempAsset(path?: string | null): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const normalized = normalizeRelativePath(path)
  if (!normalized) return ''
  if (normalized.startsWith('static/')) return `${BACKEND_ORIGIN}/${normalized}`
  if (normalized.startsWith('media/')) return `${BACKEND_ORIGIN}/${normalized}`
  if (normalized.startsWith('temp/')) return `${BACKEND_ORIGIN}/static/${normalized}`
  return `${BACKEND_ORIGIN}/static/temp/${normalized}`
}

export interface ImageCandidateOptions {
  backendOrigin: string
  useProxyForCsdn?: boolean
  preferProxy?: boolean
}

export function isRemoteHttpImage(src: string): boolean {
  return /^https?:\/\//i.test((src || '').trim())
}

export function isCsdnImageHost(src: string): boolean {
  try {
    const host = new URL(src).hostname.toLowerCase()
    return host === 'csdnimg.cn' || host.endsWith('.csdnimg.cn')
  } catch {
    return false
  }
}

export function removeImageUrlHash(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return url.split('#', 1)[0] || url
  }
}

export function buildImageProxyUrl(remoteImageUrl: string, backendOrigin: string): string {
  const cleaned = removeImageUrlHash(remoteImageUrl)
  return `${backendOrigin}/api/v1/image-proxy/?url=${encodeURIComponent(cleaned)}`
}

export function buildImageSourceCandidates(src: string, options: ImageCandidateOptions): string[] {
  const normalized = (src || '').trim()
  if (!normalized) return []

  const {
    backendOrigin,
    useProxyForCsdn = true,
    preferProxy = true,
  } = options

  if (!isRemoteHttpImage(normalized)) {
    return [normalized]
  }

  if (!useProxyForCsdn || !isCsdnImageHost(normalized)) {
    return [normalized]
  }

  const proxied = buildImageProxyUrl(normalized, backendOrigin)
  const direct = removeImageUrlHash(normalized)
  const ordered = preferProxy ? [proxied, direct] : [direct, proxied]
  const deduped: string[] = []
  const seen = new Set<string>()
  for (const item of ordered) {
    const value = item.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    deduped.push(value)
  }
  return deduped
}

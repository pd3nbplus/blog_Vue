const WEBP_MIME_TYPE = 'image/webp'

const CONVERTIBLE_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/apng',
  'image/jpeg',
  'image/jpg',
  'image/bmp',
  'image/webp',
])

const CONVERTIBLE_IMAGE_EXT_PATTERN = /\.(png|apng|jpg|jpeg|bmp|webp)$/i

function isBrowserRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function supportsCanvas(): boolean {
  return typeof HTMLCanvasElement !== 'undefined'
}

function canConvertImageFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase()
  if (CONVERTIBLE_IMAGE_MIME_TYPES.has(mime)) return true
  if (mime.startsWith('image/') && mime !== 'image/gif' && mime !== 'image/svg+xml') return true
  return CONVERTIBLE_IMAGE_EXT_PATTERN.test(file.name || '')
}

export function toWebpFileName(fileName: string): string {
  const trimmed = (fileName || '').trim()
  if (!trimmed) return 'image.webp'
  const withoutQuery = trimmed.split(/[?#]/, 1)[0] || ''
  if (!withoutQuery) return 'image.webp'
  const extensionIndex = withoutQuery.lastIndexOf('.')
  const baseName = extensionIndex > 0 ? withoutQuery.slice(0, extensionIndex) : withoutQuery
  const safeBaseName = baseName || 'image'
  return `${safeBaseName}.webp`
}

function fileToImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to decode image file'))
    }

    image.src = objectUrl
  })
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), WEBP_MIME_TYPE, quality)
  })
}

export async function convertImageFileToWebp(file: File, quality = 0.9): Promise<File> {
  if (!isBrowserRuntime() || !supportsCanvas() || !canConvertImageFile(file)) return file

  const originalName = file.name || 'image'
  if (file.type === WEBP_MIME_TYPE && /\.webp$/i.test(originalName)) return file

  try {
    const image = await fileToImageElement(file)
    const width = Math.max(1, image.naturalWidth || image.width || 1)
    const height = Math.max(1, image.naturalHeight || image.height || 1)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(image, 0, 0, width, height)

    const blob = await canvasToWebpBlob(canvas, quality)
    if (!blob) return file

    return new File([blob], toWebpFileName(originalName), {
      type: WEBP_MIME_TYPE,
      lastModified: file.lastModified || Date.now(),
    })
  } catch {
    return file
  }
}

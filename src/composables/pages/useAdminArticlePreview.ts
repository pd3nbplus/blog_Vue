import { computed, nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

import { BACKEND_ORIGIN } from '@/utils/assets'
import { buildImageProxyUrl, isCsdnImageHost, isRemoteHttpImage } from '@/utils/image'
import { renderMarkdownContent } from '@/utils/markdown'

type RenderMathFn = (
  element: HTMLElement,
  options: {
    delimiters: Array<{ left: string; right: string; display: boolean }>
    throwOnError?: boolean
    strict?: 'ignore' | 'warn' | 'error'
    errorColor?: string
    trust?: boolean
  },
) => void

interface UseAdminArticlePreviewOptions {
  markdownContent: Readonly<Ref<string>>
  markdownTextareaRef: Ref<MarkdownTextareaRefInstance | null>
  previewScrollRef: Ref<HTMLElement | null>
  previewContainerRef: Ref<HTMLElement | null>
}

export interface MarkdownTextareaRefInstance {
  resizableTextArea?: { textArea?: HTMLTextAreaElement | null }
  $el?: HTMLElement
}

// Keep inferred return object types for composable consumers without duplicate type declarations.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useAdminArticlePreview(options: UseAdminArticlePreviewOptions) {
  const loadedScripts = new Set<string>()
  let editorTextareaEl: HTMLTextAreaElement | null = null
  let scrollingSyncLocked = false

  const htmlImageSrcPattern = /(<img\b[^>]*?\bsrc=["'])([^"']+)(["'][^>]*>)/gi

  function rewriteCsdnImageSrcInHtml(html: string): string {
    if (!html) return html
    return html.replace(htmlImageSrcPattern, (_, prefix: string, src: string, suffix: string) => {
      if (!isRemoteHttpImage(src) || !isCsdnImageHost(src)) return `${prefix}${src}${suffix}`
      return `${prefix}${buildImageProxyUrl(src, BACKEND_ORIGIN)}${suffix}`
    })
  }

  const previewHtml = computed(() => {
    const rendered = renderMarkdownContent(options.markdownContent.value || '')
    return rewriteCsdnImageSrcInHtml(rendered.html)
  })

  function loadScriptOnce(src: string): Promise<void> {
    if (loadedScripts.has(src)) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = () => {
        loadedScripts.add(src)
        resolve()
      }
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
      document.head.appendChild(script)
    })
  }

  async function enhancePreviewContent(): Promise<void> {
    const container = options.previewContainerRef.value
    if (!container) return

    // Load math renderer in strict order to avoid auto-render loading before katex.
    await loadScriptOnce('/js/katex.min.js')
    await loadScriptOnce('/js/auto-render.min.js')
    await loadScriptOnce('/js/highlight.min.js')

    const win = window as Window & {
      hljs?: {
        highlightElement?: (el: Element) => void
        highlightBlock?: (el: Element) => void
      }
      renderMathInElement?: RenderMathFn
    }

    container.querySelectorAll('pre code').forEach((el) => {
      const codeEl = el as HTMLElement
      if (codeEl.dataset.rawCode) {
        codeEl.textContent = codeEl.dataset.rawCode
      } else {
        codeEl.dataset.rawCode = codeEl.textContent || ''
      }
      codeEl.classList.remove('hljs')
      delete codeEl.dataset.highlighted
      codeEl.removeAttribute('data-highlighted')

      if (win.hljs?.highlightElement) {
        win.hljs.highlightElement(codeEl)
        return
      }
      if (win.hljs?.highlightBlock) {
        win.hljs.highlightBlock(codeEl)
      }
    })

    container.querySelectorAll('p').forEach((p) => {
      p.innerHTML = p.innerHTML.replace(/\\\s*\n/g, '\\\\')
    })

    try {
      win.renderMathInElement?.(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        strict: 'ignore',
        errorColor: '#cc0000',
      })
    } catch {
      // Keep preview usable even if a malformed formula appears in markdown.
    }
  }

  function resolveEditorTextareaElement(): HTMLTextAreaElement | null {
    const instance = options.markdownTextareaRef.value
    if (!instance) return null
    if (instance.resizableTextArea?.textArea) {
      return instance.resizableTextArea.textArea
    }
    return instance.$el?.querySelector('textarea') || null
  }

  function syncScrollPosition(source: HTMLElement, target: HTMLElement): void {
    const sourceMax = source.scrollHeight - source.clientHeight
    const targetMax = target.scrollHeight - target.clientHeight
    if (sourceMax <= 0 || targetMax <= 0) {
      target.scrollTop = 0
      return
    }
    const ratio = source.scrollTop / sourceMax
    target.scrollTop = ratio * targetMax
  }

  function runScrollSync(task: () => void): void {
    if (scrollingSyncLocked) return
    scrollingSyncLocked = true
    task()
    requestAnimationFrame(() => {
      scrollingSyncLocked = false
    })
  }

  function handleEditorScroll(): void {
    const source = editorTextareaEl
    const target = options.previewScrollRef.value
    if (!source || !target) return
    runScrollSync(() => {
      syncScrollPosition(source, target)
    })
  }

  function handlePreviewScroll(): void {
    const source = options.previewScrollRef.value
    const target = editorTextareaEl
    if (!source || !target) return
    runScrollSync(() => {
      syncScrollPosition(source, target)
    })
  }

  function bindEditorScrollListener(): void {
    const nextTextarea = resolveEditorTextareaElement()
    if (editorTextareaEl === nextTextarea) return
    if (editorTextareaEl) {
      editorTextareaEl.removeEventListener('scroll', handleEditorScroll)
    }
    editorTextareaEl = nextTextarea
    if (editorTextareaEl) {
      editorTextareaEl.addEventListener('scroll', handleEditorScroll, { passive: true })
    }
  }

  watch(
    previewHtml,
    async () => {
      await nextTick()
      bindEditorScrollListener()
      const container = options.previewContainerRef.value
      if (!container) return

      container.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src') || ''
        if (!src) return
        if (isRemoteHttpImage(src)) {
          img.setAttribute('referrerpolicy', 'no-referrer')
        }
        img.setAttribute('loading', 'lazy')
      })

      await enhancePreviewContent()
    },
    { immediate: true },
  )

  onMounted(async () => {
    await nextTick()
    bindEditorScrollListener()
  })

  onBeforeUnmount(() => {
    if (editorTextareaEl) {
      editorTextareaEl.removeEventListener('scroll', handleEditorScroll)
    }
    editorTextareaEl = null
  })

  return {
    previewHtml,
    handlePreviewScroll,
  }
}

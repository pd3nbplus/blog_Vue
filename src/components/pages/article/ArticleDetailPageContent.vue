<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { useArticleDetailPage } from '@/composables/pages/useArticleDetailPage'
import { BACKEND_ORIGIN, normalizeRelativePath } from '@/utils/assets'
import { getArticleStatusLabel } from '@/utils/articleStatus'
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

const { detail, loading } = useArticleDetailPage()
const loadedScripts = new Set<string>()
const renderedHtml = ref('')
const tocHtml = ref('')
const markdownContainerRef = ref<HTMLElement | null>(null)
const HTML_IMAGE_SRC_PATTERN = /(<img\b[^>]*?\bsrc=["'])([^"']+)(["'][^>]*>)/gi

function formatDateTime(input?: string | null, mode: 'datetime' | 'date' = 'datetime'): string {
  if (!input) return '-'
  if (mode === 'date') return input.slice(0, 10).replace(/-/g, '/')
  return input.slice(0, 16).replace('T', ' ')
}

const wordCount = computed(() => {
  const markdown = detail.value?.markdown_content || ''
  if (!markdown) return 0
  const withoutCode = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
  const cnChars = withoutCode.match(/[\u4e00-\u9fff]/g)?.length || 0
  const words = withoutCode.match(/[A-Za-z0-9_]+/g)?.length || 0
  return cnChars + words
})

const estimatedReadMinutes = computed(() => {
  const backendEstimate = detail.value?.read_minutes
  if (typeof backendEstimate === 'number' && backendEstimate > 0) {
    return backendEstimate
  }
  const count = wordCount.value
  if (!count) return 1
  return Math.max(1, Math.ceil(count / 300))
})

const articleMetadata = computed(() => {
  if (!detail.value) return []
  const meta = [
    { label: '作者', value: detail.value.author.username || '-' },
    { label: '分类', value: detail.value.category?.name || '未分类' },
    { label: '发布时间', value: formatDateTime(detail.value.published_at || detail.value.created_at, 'date') },
    { label: '更新时间', value: formatDateTime(detail.value.updated_at) },
    { label: '阅读量', value: String(detail.value.view_count ?? 0) },
    { label: '字数', value: `${wordCount.value}` },
    { label: '预估阅读', value: `${estimatedReadMinutes.value} 分钟` },
    { label: '状态', value: getArticleStatusLabel(detail.value.status) },
  ]
  if (detail.value.is_pinned) {
    meta.push({ label: '置顶', value: '是' })
  }
  return meta
})

function resolveMarkdownImageSrc(rawSrc: string, sourceMarkdownPath: string): string {
  const src = rawSrc.trim().replace(/\\/g, '/')
  if (!src) return rawSrc
  if (/^(https?:)?\/\//i.test(src)) return src
  if (src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('#')) return src

  const normalizedSource = normalizeRelativePath(sourceMarkdownPath || '')
  const isLegacySource = normalizedSource.startsWith('static/temp/')
  const sourceRoot = isLegacySource ? '/static/temp' : '/media/articles'
  const sourceDir =
    normalizedSource && normalizedSource.includes('/')
      ? normalizedSource.slice(0, normalizedSource.lastIndexOf('/') + 1).replace(/^(static\/temp\/|media\/articles\/)/, '')
      : ''

  if (src.startsWith('/')) {
    if (src.startsWith('/static/') || src.startsWith('/media/')) {
      return `${BACKEND_ORIGIN}${src}`
    }
    return `${BACKEND_ORIGIN}${sourceRoot}${src}`
  }

  if (src.startsWith('static/')) {
    return `${BACKEND_ORIGIN}/${src}`
  }
  if (src.startsWith('media/')) {
    return `${BACKEND_ORIGIN}/${src}`
  }
  if (src.startsWith('temp/')) {
    return `${BACKEND_ORIGIN}/static/${src}`
  }

  try {
    return new URL(src, `${BACKEND_ORIGIN}${sourceRoot}/${sourceDir}`).toString()
  } catch {
    return `${BACKEND_ORIGIN}${sourceRoot}/${sourceDir}${src}`
  }
}

function rewriteCsdnImageSrcInHtml(html: string): string {
  if (!html) return html
  return html.replace(HTML_IMAGE_SRC_PATTERN, (_, prefix: string, src: string, suffix: string) => {
    if (!isRemoteHttpImage(src) || !isCsdnImageHost(src)) return `${prefix}${src}${suffix}`
    return `${prefix}${buildImageProxyUrl(src, BACKEND_ORIGIN)}${suffix}`
  })
}

function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

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

async function enhanceArticleContent(): Promise<void> {
  if (!detail.value || !renderedHtml.value) return
  await nextTick()

  // Load math renderer in strict order to avoid auto-render loading before katex.
  await loadScriptOnce('/js/katex.min.js')
  await loadScriptOnce('/js/auto-render.min.js')
  await loadScriptOnce('/js/highlight.min.js')

  const markdownContainer = markdownContainerRef.value
  if (!markdownContainer) return

  const sourceMarkdownPath = detail.value.source_markdown_path || ''
  markdownContainer.querySelectorAll('img').forEach((img) => {
    const rawSrc = img.getAttribute('src') || ''
    const resolvedSrc = rawSrc ? resolveMarkdownImageSrc(rawSrc, sourceMarkdownPath) : ''
    if (!resolvedSrc) return
    const isRemote = isRemoteHttpImage(resolvedSrc)
    const canUseProxy = isRemote && isCsdnImageHost(resolvedSrc)
    const shouldUseProxy = canUseProxy
    const finalSrc = shouldUseProxy ? buildImageProxyUrl(resolvedSrc, BACKEND_ORIGIN) : resolvedSrc

    // CSDN 等图床会拦截外站 Referer，请求时使用 no-referrer。
    if (isRemote) {
      img.setAttribute('referrerpolicy', 'no-referrer')
    }

    // Re-assign src after setting referrer policy to ensure reload with new policy.
    img.setAttribute('src', '')
    img.setAttribute('src', finalSrc)
    img.setAttribute('loading', 'lazy')
    img.addEventListener(
      'error',
      () => {
        if (canUseProxy && img.getAttribute('data-proxy-retry') !== '1') {
          img.setAttribute('data-proxy-retry', '1')
          img.setAttribute('src', buildImageProxyUrl(resolvedSrc, BACKEND_ORIGIN))
          return
        }
        ;(img as HTMLElement).style.display = 'none'
      },
      { once: true },
    )
  })

  const win = window as Window & {
    hljs?: {
      initHighlightingOnLoad?: () => void
      highlightElement?: (el: Element) => void
      highlightBlock?: (el: Element) => void
    }
    renderMathInElement?: RenderMathFn
  }

  markdownContainer.querySelectorAll('pre code').forEach((el) => {
    const codeEl = el as HTMLElement
    // Re-highlight from raw code text each time to avoid nested hljs spans.
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

  markdownContainer.querySelectorAll('p').forEach((p) => {
    p.innerHTML = p.innerHTML.replace(/\\\s*\n/g, '\\\\')
  })

  try {
    win.renderMathInElement?.(markdownContainer, {
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
    // Keep article readable even if a malformed formula appears.
  }
}

watch(
  () => detail.value?.markdown_content,
  () => {
    const markdownContent = detail.value?.markdown_content || ''
    const rendered = renderMarkdownContent(markdownContent)
    renderedHtml.value = rewriteCsdnImageSrcInHtml(rendered.html)
    tocHtml.value = rendered.tocHtml
  },
  { immediate: true },
)

watch(
  renderedHtml,
  () => {
    void enhanceArticleContent()
  },
  { immediate: true },
)
</script>

<template>
  <a-spin :spinning="loading">
    <div v-if="detail">
      <div class="article-shell">
        <aside class="meta-fixed">
          <div class="meta-fixed-inner">
            <h1 class="article-title article-title-vertical">{{ detail.title }}</h1>
            <div class="meta-fixed-content">
              <ul class="article-meta-list">
                <li v-for="item in articleMetadata" :key="item.label" class="article-meta-item">
                  <span class="meta-label">{{ item.label }}</span>
                  <span class="meta-value">{{ item.value }}</span>
                </li>
              </ul>
              <p v-if="detail.summary" class="article-summary">{{ detail.summary }}</p>
            </div>
          </div>
        </aside>

        <div class="article-main">
          <article ref="markdownContainerRef" class="markdown-body article-markdown">
            <div v-html="renderedHtml" />
          </article>
        </div>
        <aside v-if="tocHtml" class="toc-container">
          <div class="markdown-body toc-markdown" v-html="tocHtml" />
          <button type="button" class="toc-back-to-top" @click="scrollToTop">
            <img src="/img/back-top.png" alt="回到顶部" />
          </button>
        </aside>
      </div>
    </div>
  </a-spin>
</template>

<style>
@import '/css/bootstrap.min.css';
@import '/css/github-markdown.min.css';
@import '/css/default.min.css';
@import 'katex/dist/katex.min.css';
@import '@/styles/legacy/article_detail.css';
</style>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import type { FormInstance } from 'ant-design-vue'
import type { UploadProps } from 'ant-design-vue'
import { UploadOutlined } from '@ant-design/icons-vue'

import AppImage from '@/components/common/AppImage.vue'
import {
  resolveAdminArticleLocalImages,
  uploadAdminArticleCover,
} from '@/services/api/adminArticle'
import type { AdminArticlePayload, CategoryItem } from '@/types/article'
import { BACKEND_ORIGIN, resolveTempAsset } from '@/utils/assets'
import { buildImageProxyUrl, isCsdnImageHost, isRemoteHttpImage } from '@/utils/image'
import { matchLocalImageRefs, mergeLocalImageFiles } from '@/utils/localImageMapping'
import { renderMarkdownContent } from '@/utils/markdown'

type RenderMathFn = (
  element: HTMLElement,
  options: { delimiters: Array<{ left: string; right: string; display: boolean }> },
) => void

interface AdminArticleFormInput {
  title: string
  slug: string
  summary: string
  markdown_content: string
  source_markdown_path: string
  cover_path: string
  category: number | null
  status: 'draft' | 'published' | 'archived'
  is_pinned: boolean
}

const props = withDefaults(
  defineProps<{
    loading?: boolean
    submitting: boolean
    categoryTree: CategoryItem[]
    initialValue?: Partial<AdminArticlePayload> | null
    editing: boolean
  }>(),
  {
    loading: false,
    initialValue: null,
  },
)

const emit = defineEmits<{
  submit: [value: AdminArticlePayload]
  cancel: []
}>()

const formState = reactive<AdminArticleFormInput>({
  title: '',
  slug: '',
  summary: '',
  markdown_content: '',
  source_markdown_path: '',
  cover_path: '',
  category: null,
  status: 'draft',
  is_pinned: false,
})

const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
]

const rules = computed<Record<string, Rule[]>>(() => ({
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  slug: [{ required: true, message: '请输入 slug', trigger: 'blur' }],
  markdown_content: [{ required: true, message: '请输入 Markdown 正文', trigger: 'blur' }],
}))

function resetForm() {
  formState.title = ''
  formState.slug = ''
  formState.summary = ''
  formState.markdown_content = ''
  formState.source_markdown_path = ''
  formState.cover_path = ''
  formState.category = null
  formState.status = 'draft'
  formState.is_pinned = false
}

function syncFormFromInitialValue() {
  resetForm()
  if (!props.initialValue) return

  formState.title = props.initialValue.title ?? ''
  formState.slug = props.initialValue.slug ?? ''
  formState.summary = props.initialValue.summary ?? ''
  formState.markdown_content = props.initialValue.markdown_content ?? ''
  formState.source_markdown_path = props.initialValue.source_markdown_path ?? ''
  formState.cover_path = props.initialValue.cover_path ?? ''
  formState.category = props.initialValue.category ?? null
  formState.status = props.initialValue.status ?? 'draft'
  formState.is_pinned = props.initialValue.is_pinned ?? false
}

const formRef = ref<FormInstance>()
const pendingSubmitPayload = ref<AdminArticlePayload | null>(null)
const localImageDialogOpen = ref(false)
const localImageSubmitting = ref(false)
const pendingLocalRefs = ref<string[]>([])
const selectedLocalFiles = ref<File[]>([])
const markdownFileUploading = ref(false)
const selectedMarkdownFile = ref<File | null>(null)
const markdownUploadList = ref<Array<{ uid: string; name: string; status: 'done' }>>([])
const coverUploading = ref(false)
const selectedCoverFile = ref<File | null>(null)
const coverUploadList = ref<Array<{ uid: string; name: string; status: 'done' }>>([])
const localCoverPreviewUrl = ref('')
const markdownTextareaRef = ref<unknown>(null)
const previewScrollRef = ref<HTMLElement | null>(null)
let editorTextareaEl: HTMLTextAreaElement | null = null
let scrollingSyncLocked = false
const loadedScripts = new Set<string>()
const expandedParentCategoryId = ref<number | null>(null)

interface CategoryTreeSelectNode {
  title: string
  value: number
  key: number
  selectable: boolean
  children?: CategoryTreeSelectNode[]
}

const categoryTreeData = computed<CategoryTreeSelectNode[]>(() => {
  const mapNodes = (nodes: CategoryItem[]): CategoryTreeSelectNode[] =>
    nodes.map((node) => {
      const children = node.children?.length ? mapNodes(node.children) : undefined
      const hasChildren = Boolean(children && children.length)
      return {
        title: node.name,
        value: node.id,
        key: node.id,
        selectable: !hasChildren,
        ...(children ? { children } : {}),
      }
    })
  return mapNodes(props.categoryTree || [])
})

const topLevelCategoryIdSet = computed<Set<number>>(() => {
  return new Set((props.categoryTree || []).map((item) => item.id))
})

const categoryExpandedKeys = computed<number[]>(() => {
  if (!expandedParentCategoryId.value) return []
  return [expandedParentCategoryId.value]
})

function handleCategoryDropdownVisibleChange(open: boolean): void {
  if (open) {
    expandedParentCategoryId.value = null
  }
}

function handleCategoryTreeExpand(
  _expandedKeys: Array<string | number>,
  info: {
    expanded: boolean
    node?: { value?: string | number; key?: string | number }
  },
): void {
  const node = info.node
  if (!node) return

  const nodeKey = Number(node.value ?? node.key)
  if (!Number.isFinite(nodeKey) || nodeKey <= 0) return
  if (!topLevelCategoryIdSet.value.has(nodeKey)) return

  expandedParentCategoryId.value = info.expanded ? nodeKey : null
}

watch(
  () => props.initialValue,
  () => {
    syncFormFromInitialValue()
    resetAssetSelectionState()
  },
  { immediate: true },
)

const HTML_IMAGE_SRC_PATTERN = /(<img\b[^>]*?\bsrc=["'])([^"']+)(["'][^>]*>)/gi
const htmlImageRefPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
const fencedCodeBlockPattern = /```[\s\S]*?```|~~~[\s\S]*?~~~/g

function stripFencedCodeBlocks(content: string): string {
  return content.replace(fencedCodeBlockPattern, '')
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

function extractLocalImageRefs(markdownContent: string): string[] {
  const content = stripFencedCodeBlocks(markdownContent || '')
  const refs: string[] = []
  const seen = new Set<string>()

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

  for (const match of content.matchAll(htmlImageRefPattern)) {
    const normalized = normalizeImageRef(match[1] || '')
    if (!normalized || !isLocalImageRef(normalized) || seen.has(normalized)) continue
    seen.add(normalized)
    refs.push(normalized)
  }

  return refs
}

function resetLocalImageDialog() {
  pendingSubmitPayload.value = null
  pendingLocalRefs.value = []
  selectedLocalFiles.value = []
  localImageDialogOpen.value = false
}

function resetAssetSelectionState() {
  selectedMarkdownFile.value = null
  markdownUploadList.value = []
  selectedCoverFile.value = null
  coverUploadList.value = []
  if (localCoverPreviewUrl.value) {
    URL.revokeObjectURL(localCoverPreviewUrl.value)
    localCoverPreviewUrl.value = ''
  }
}

const handleMarkdownBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  if (markdownFileUploading.value) {
    message.warning('Markdown 正在解析中，请稍候')
    return false
  }
  const selected = file as File
  selectedMarkdownFile.value = selected
  markdownUploadList.value = [{ uid: selected.name, name: selected.name, status: 'done' }]
  void applyMarkdownFileToForm(selected)
  return false
}

const handleMarkdownRemove: UploadProps['onRemove'] = () => {
  selectedMarkdownFile.value = null
  markdownUploadList.value = []
  return true
}

function extractMarkdownBaseName(filename: string): string {
  const normalized = filename.split('/').pop()?.split('\\').pop() || filename
  return normalized.replace(/\.[^./\\]+$/, '').trim()
}

function sanitizeFileStemForPath(filename: string): string {
  const stem = extractMarkdownBaseName(filename)
  const lowered = stem.toLowerCase().trim()
  const sanitized = lowered.replace(/[^a-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
  return sanitized || 'article'
}

function inferSourceMarkdownPath(filename: string): string {
  const now = new Date()
  const dateDir = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const safeStem = sanitizeFileStemForPath(filename)
  return `/static/temp/uploads/${dateDir}/${safeStem}.md`
}

async function readTextFromFile(file: File): Promise<string> {
  return file.text()
}

async function applyMarkdownFileToForm(file: File) {
  markdownFileUploading.value = true
  try {
    const text = await readTextFromFile(file)
    formState.markdown_content = text
    if (!formState.source_markdown_path.trim()) {
      formState.source_markdown_path = inferSourceMarkdownPath(file.name)
    }
    if (!formState.title.trim()) {
      const inferredTitle = extractMarkdownBaseName(file.name)
      if (inferredTitle) {
        formState.title = inferredTitle
      }
    }
    message.success('Markdown 已载入编辑器，发布时才会提交到后端')
  } catch {
    message.error('Markdown 文件读取失败')
  } finally {
    markdownFileUploading.value = false
  }
}

const handleCoverBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  if (coverUploading.value) {
    message.warning('封面正在上传中，请稍候')
    return false
  }
  const selected = file as File
  selectedCoverFile.value = selected
  coverUploadList.value = [{ uid: selected.name, name: selected.name, status: 'done' }]
  if (localCoverPreviewUrl.value) {
    URL.revokeObjectURL(localCoverPreviewUrl.value)
  }
  localCoverPreviewUrl.value = URL.createObjectURL(selected)
  message.success('封面已选择，发布时自动上传')
  return false
}

const handleCoverRemove: UploadProps['onRemove'] = () => {
  selectedCoverFile.value = null
  coverUploadList.value = []
  if (localCoverPreviewUrl.value) {
    URL.revokeObjectURL(localCoverPreviewUrl.value)
    localCoverPreviewUrl.value = ''
  }
  return true
}

const coverPreview = computed(() => {
  if (localCoverPreviewUrl.value) return localCoverPreviewUrl.value
  const value = formState.cover_path.trim()
  if (!value) return ''
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('/img/')) return value
  if (value.startsWith('/')) return `${BACKEND_ORIGIN}${value}`
  return resolveTempAsset(value)
})

async function uploadCoverBeforeSubmit(payload: AdminArticlePayload): Promise<boolean> {
  const file = selectedCoverFile.value
  if (!file) return true

  coverUploading.value = true
  try {
    const data = await uploadAdminArticleCover({
      file,
      source_markdown_path: payload.source_markdown_path.trim() || undefined,
    })
    payload.cover_path = data.cover_path
    formState.cover_path = data.cover_path
    selectedCoverFile.value = null
    coverUploadList.value = []
    if (localCoverPreviewUrl.value) {
      URL.revokeObjectURL(localCoverPreviewUrl.value)
      localCoverPreviewUrl.value = ''
    }
    message.success('封面图片已上传')
    return true
  } catch {
    message.error('封面图片上传失败')
    return false
  } finally {
    coverUploading.value = false
  }
}

const handleLocalFilesBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  selectedLocalFiles.value = mergeLocalImageFiles(selectedLocalFiles.value, [file as File])
  return false
}

const handleLocalDirectoryBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  selectedLocalFiles.value = mergeLocalImageFiles(selectedLocalFiles.value, [file as File])
  return false
}

function clearSelectedLocalFiles() {
  selectedLocalFiles.value = []
}

const detectedLocalRefs = computed(() => extractLocalImageRefs(formState.markdown_content))
const localImageMatchResult = computed(() => matchLocalImageRefs(pendingLocalRefs.value, selectedLocalFiles.value))
const localImageMatchStats = computed(() => {
  const result = localImageMatchResult.value
  return {
    matched: result.mappings.length,
    unmatched: result.unmatchedRefs.length,
    ambiguous: result.ambiguousRefs.length,
  }
})
const sourceMarkdownPathMissingForUpload = computed(() => {
  const payload = pendingSubmitPayload.value
  if (!payload) return false
  if (localImageMatchResult.value.mappings.length <= 0) return false
  return !payload.source_markdown_path.trim()
})

function getPreviewStatusText(status: 'matched' | 'unmatched' | 'ambiguous'): string {
  if (status === 'matched') return '已匹配'
  if (status === 'ambiguous') return '匹配冲突'
  return '未匹配'
}

function rewriteCsdnImageSrcInHtml(html: string): string {
  if (!html) return html
  return html.replace(HTML_IMAGE_SRC_PATTERN, (_, prefix: string, src: string, suffix: string) => {
    if (!isRemoteHttpImage(src) || !isCsdnImageHost(src)) return `${prefix}${src}${suffix}`
    return `${prefix}${buildImageProxyUrl(src, BACKEND_ORIGIN)}${suffix}`
  })
}

const previewHtml = computed(() => {
  const rendered = renderMarkdownContent(formState.markdown_content || '')
  return rewriteCsdnImageSrcInHtml(rendered.html)
})

const previewContainerRef = ref<HTMLElement | null>(null)

function loadScriptOnce(src: string) {
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

async function enhancePreviewContent() {
  const container = previewContainerRef.value
  if (!container) return

  await Promise.all([loadScriptOnce('/js/highlight.min.js'), loadScriptOnce('/js/katex.min.js'), loadScriptOnce('/js/auto-render.min.js')])

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

  win.renderMathInElement?.(container, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
    ],
  })
}

function resolveEditorTextareaElement(): HTMLTextAreaElement | null {
  const instance = markdownTextareaRef.value as
    | {
        resizableTextArea?: { textArea?: HTMLTextAreaElement | null }
        $el?: HTMLElement
      }
    | null
  if (!instance) return null
  if (instance.resizableTextArea?.textArea) {
    return instance.resizableTextArea.textArea
  }
  return instance.$el?.querySelector('textarea') || null
}

function bindEditorScrollListener() {
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

function syncScrollPosition(source: HTMLElement, target: HTMLElement) {
  const sourceMax = source.scrollHeight - source.clientHeight
  const targetMax = target.scrollHeight - target.clientHeight
  if (sourceMax <= 0 || targetMax <= 0) {
    target.scrollTop = 0
    return
  }
  const ratio = source.scrollTop / sourceMax
  target.scrollTop = ratio * targetMax
}

function runScrollSync(task: () => void) {
  if (scrollingSyncLocked) return
  scrollingSyncLocked = true
  task()
  requestAnimationFrame(() => {
    scrollingSyncLocked = false
  })
}

function handleEditorScroll() {
  const source = editorTextareaEl
  const target = previewScrollRef.value
  if (!source || !target) return
  runScrollSync(() => {
    syncScrollPosition(source, target)
  })
}

function handlePreviewScroll() {
  const source = previewScrollRef.value
  const target = editorTextareaEl
  if (!source || !target) return
  runScrollSync(() => {
    syncScrollPosition(source, target)
  })
}

onMounted(async () => {
  await nextTick()
  bindEditorScrollListener()
})

onBeforeUnmount(() => {
  if (editorTextareaEl) {
    editorTextareaEl.removeEventListener('scroll', handleEditorScroll)
  }
  editorTextareaEl = null
  resetAssetSelectionState()
})

watch(
  previewHtml,
  async () => {
    await nextTick()
    bindEditorScrollListener()
    const container = previewContainerRef.value
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

async function handleConfirm() {
  if (markdownFileUploading.value || coverUploading.value) {
    message.warning('资源处理中，请稍候再提交')
    return
  }

  const formInstance = formRef.value
  if (formInstance?.validate) {
    await formInstance.validate()
  }

  const payload: AdminArticlePayload = {
    title: formState.title.trim(),
    slug: formState.slug.trim(),
    summary: formState.summary.trim(),
    markdown_content: formState.markdown_content,
    source_markdown_path: formState.source_markdown_path.trim(),
    cover_path: formState.cover_path.trim(),
    category: formState.category,
    status: formState.status,
    is_pinned: formState.is_pinned,
  }

  const localRefs = extractLocalImageRefs(payload.markdown_content)
  if (localRefs.length > 0) {
    pendingSubmitPayload.value = payload
    pendingLocalRefs.value = localRefs
    selectedLocalFiles.value = []
    localImageDialogOpen.value = true
    return
  }

  const uploaded = await uploadCoverBeforeSubmit(payload)
  if (!uploaded) return
  emit('submit', payload)
}

async function handleSkipUploadAndSubmit() {
  const payload = pendingSubmitPayload.value
  resetLocalImageDialog()
  if (payload) {
    const uploaded = await uploadCoverBeforeSubmit(payload)
    if (!uploaded) return
    emit('submit', payload)
  }
}

async function handleUploadAndSubmit() {
  const payload = pendingSubmitPayload.value
  if (!payload) return

  const { mappings, unmatchedRefs, ambiguousRefs } = localImageMatchResult.value

  if (mappings.length > 0) {
    if (!payload.source_markdown_path.trim()) {
      message.error('已匹配到本地图片，但缺少来源 Markdown 路径，请先补全后再上传')
      return
    }

    localImageSubmitting.value = true
    try {
      const result = await resolveAdminArticleLocalImages({
        markdown_content: payload.markdown_content,
        source_markdown_path: payload.source_markdown_path,
        mappings,
      })

      payload.markdown_content = result.markdown_content
      payload.source_markdown_path = result.source_markdown_path || payload.source_markdown_path

      const unresolved = new Set<string>([...unmatchedRefs, ...ambiguousRefs, ...(result.unresolved_refs || [])])
      if (unresolved.size > 0) {
        const sample = Array.from(unresolved).slice(0, 2).join('、')
        message.warning(`本地图片仍有 ${unresolved.size} 处未处理：${sample}${unresolved.size > 2 ? '…' : ''}`)
      } else {
        message.success(`本地图片处理完成，已上传 ${result.uploaded.length} 个文件并重写引用`)
      }
    } catch {
      message.error('本地图片上传失败，请重试')
      return
    } finally {
      localImageSubmitting.value = false
    }
  } else {
    const unresolvedTotal = unmatchedRefs.length + ambiguousRefs.length
    if (unresolvedTotal > 0) {
      message.warning(`未匹配到可上传图片（未匹配 ${unmatchedRefs.length}，冲突 ${ambiguousRefs.length}），将直接提交`)
    } else {
      message.info('未选择图片文件，已直接提交文章')
    }
  }

  const submitPayload = { ...payload }
  resetLocalImageDialog()
  const uploaded = await uploadCoverBeforeSubmit(submitPayload)
  if (!uploaded) return
  emit('submit', submitPayload)
}
</script>

<template>
  <section class="editor-page app-surface-card">
    <div class="editor-head">
      <div class="head-title">
        <h2>{{ editing ? '编辑文章' : '新建文章' }}</h2>
        <p>左侧编辑 Markdown 原文，右侧实时渲染预览</p>
      </div>
      <a-space>
        <a-button :disabled="submitting" @click="emit('cancel')">返回列表</a-button>
        <a-button type="primary" :loading="submitting" @click="handleConfirm">
          {{ editing ? '保存修改' : '发布文章' }}
        </a-button>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical">
        <div class="meta-grid">
          <a-form-item label="标题" name="title">
            <a-input v-model:value="formState.title" />
          </a-form-item>
          <a-form-item label="slug" name="slug">
            <a-input v-model:value="formState.slug" />
          </a-form-item>
          <a-form-item label="状态" name="status">
            <a-select v-model:value="formState.status" :options="statusOptions" />
          </a-form-item>
          <a-form-item label="分类">
            <a-tree-select
              v-model:value="formState.category"
              allow-clear
              :tree-data="categoryTreeData"
              :tree-expanded-keys="categoryExpandedKeys"
              :show-search="false"
              tree-expand-action="click"
              placeholder="先点击一级分类，再选择二级分类"
              @dropdownVisibleChange="handleCategoryDropdownVisibleChange"
              @treeExpand="handleCategoryTreeExpand"
            />
          </a-form-item>
        </div>

        <a-form-item label="摘要">
          <a-textarea v-model:value="formState.summary" :rows="3" />
        </a-form-item>

        <div class="asset-grid">
          <a-form-item label="来源 Markdown 路径" class="asset-item">
            <a-input v-model:value="formState.source_markdown_path" placeholder="例如：深度学习/NLP/xxx.md" />
          </a-form-item>
          <a-form-item label="封面路径" class="asset-item">
            <a-input v-model:value="formState.cover_path" placeholder="可填本地路径或外链 URL" />
            <div class="upload-line">
              <a-upload
                :file-list="coverUploadList"
                :before-upload="handleCoverBeforeUpload"
                :max-count="1"
                accept="image/*"
                @remove="handleCoverRemove"
              >
                <a-button size="small" :loading="coverUploading">
                  <UploadOutlined />
                  选择封面
                </a-button>
              </a-upload>
            </div>
            <AppImage v-if="coverPreview" :src="coverPreview" alt="cover preview" class="cover-preview" fallback-src="/img/hero-image.jpg" />
          </a-form-item>
        </div>

        <a-form-item>
          <a-checkbox v-model:checked="formState.is_pinned">置顶文章</a-checkbox>
        </a-form-item>

        <div class="editor-columns">
          <section class="editor-column">
            <a-form-item label="Markdown 正文" name="markdown_content">
              <div class="upload-line">
                <a-upload
                  :file-list="markdownUploadList"
                  :before-upload="handleMarkdownBeforeUpload"
                  :max-count="1"
                  accept=".md,.markdown,.txt,.html,.htm"
                  @remove="handleMarkdownRemove"
                >
                  <a-button size="small" :loading="markdownFileUploading">
                    <UploadOutlined />
                    选择 Markdown
                  </a-button>
                </a-upload>
              </div>
              <a-textarea
                ref="markdownTextareaRef"
                v-model:value="formState.markdown_content"
                class="markdown-textarea"
                :auto-size="false"
              />
              <div v-if="detectedLocalRefs.length" class="local-image-tip">
                检测到 {{ detectedLocalRefs.length }} 处本地图片引用，提交时将提示上传并自动处理引用路径。
              </div>
            </a-form-item>
          </section>

          <section class="editor-column preview-column">
            <h3 class="preview-title">实时预览</h3>
            <div ref="previewScrollRef" class="preview-scroll" @scroll.passive="handlePreviewScroll">
              <div v-if="!formState.markdown_content.trim()" class="preview-empty">在左侧输入 Markdown 后，这里会实时渲染结果。</div>
              <article v-else ref="previewContainerRef" class="preview-markdown markdown-body" v-html="previewHtml" />
            </div>
          </section>
        </div>
      </a-form>
    </a-spin>
  </section>

  <a-modal
    :open="localImageDialogOpen"
    title="检测到本地图片引用"
    :confirm-loading="localImageSubmitting"
    ok-text="上传并继续提交"
    cancel-text="直接提交"
    @ok="handleUploadAndSubmit"
    @cancel="handleSkipUploadAndSubmit"
  >
    <p>检测到 {{ pendingLocalRefs.length }} 处本地图片引用。</p>
    <p>可选择单个文件或整个图片目录，系统将优先按“相对路径”匹配，失败时再按“文件名”匹配。</p>
    <div class="upload-line">
      <a-upload :show-upload-list="false" :before-upload="handleLocalFilesBeforeUpload" multiple accept="image/*">
        <a-button size="small">
          <UploadOutlined />
          选择图片文件
        </a-button>
      </a-upload>
      <a-upload
        :show-upload-list="false"
        :before-upload="handleLocalDirectoryBeforeUpload"
        directory
        multiple
        accept="image/*"
      >
        <a-button size="small">
          <UploadOutlined />
          选择图片目录
        </a-button>
      </a-upload>
      <a-button type="link" size="small" @click="clearSelectedLocalFiles">清空已选</a-button>
    </div>
    <p class="selected-files">
      已选择 {{ selectedLocalFiles.length }} 个文件
      （已匹配 {{ localImageMatchStats.matched }}，未匹配 {{ localImageMatchStats.unmatched }}，冲突
      {{ localImageMatchStats.ambiguous }}）
    </p>
    <p v-if="sourceMarkdownPathMissingForUpload" class="mapping-warning">
      已匹配到图片，但“来源 Markdown 路径”为空，暂不可上传，请先补全该字段。
    </p>
    <div class="ref-list">
      <p>本次检测结果：</p>
      <ul>
        <li v-for="item in localImageMatchResult.previews" :key="item.ref" class="ref-item">
          <code>{{ item.ref }}</code>
          <span class="ref-status" :class="`ref-status--${item.status}`">{{ getPreviewStatusText(item.status) }}</span>
          <span v-if="item.status === 'matched'" class="ref-detail">
            {{ item.strategy === 'path' ? '路径匹配' : '文件名匹配' }} -> {{ item.matchedFileDisplay || item.matchedFileName }}
          </span>
          <span v-else-if="item.status === 'ambiguous'" class="ref-detail">
            候选：{{ item.candidateDisplays?.slice(0, 2).join('、') }}{{ (item.candidateDisplays?.length || 0) > 2 ? '…' : '' }}
          </span>
        </li>
      </ul>
    </div>
  </a-modal>
</template>

<style scoped>
@import '/css/github-markdown.min.css';
@import '/css/default.min.css';
@import 'katex/dist/katex.min.css';
@import '@/styles/pages/admin-article-editor-panel.css';
</style>

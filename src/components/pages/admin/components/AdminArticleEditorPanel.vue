<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import type { FormInstance } from 'ant-design-vue'

import {
  resolveAdminArticleLocalImages,
  uploadAdminArticleCover,
  uploadAdminArticleMarkdown,
} from '@/services/adminArticle'
import type { AdminArticlePayload } from '@/types/article'
import type { CategoryOption } from '@/utils/article'
import { BACKEND_ORIGIN, resolveTempAsset } from '@/utils/assets'
import { matchLocalImageRefs, mergeLocalImageFiles } from '@/utils/localImageMapping'
import { renderMarkdownContent } from '@/utils/markdown'

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
    categoryOptions: CategoryOption[]
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
const coverUploading = ref(false)
const selectedCoverFile = ref<File | null>(null)

watch(
  () => props.initialValue,
  () => {
    syncFormFromInitialValue()
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

function handleMarkdownFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  selectedMarkdownFile.value = input.files?.[0] || null
}

async function handleMarkdownFileUpload() {
  const file = selectedMarkdownFile.value
  if (!file) {
    message.warning('请先选择 Markdown 文件')
    return
  }
  markdownFileUploading.value = true
  try {
    const data = await uploadAdminArticleMarkdown({
      file,
      source_markdown_path: formState.source_markdown_path.trim() || undefined,
    })
    formState.markdown_content = data.markdown_content
    formState.source_markdown_path = data.source_markdown_path
    message.success('Markdown 文件已上传并同步到表单')
  } catch {
    message.error('Markdown 文件上传失败')
  } finally {
    markdownFileUploading.value = false
  }
}

function handleCoverFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  selectedCoverFile.value = input.files?.[0] || null
}

const coverPreview = computed(() => {
  const value = formState.cover_path.trim()
  if (!value) return ''
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) return value
  return resolveTempAsset(value)
})

async function handleCoverFileUpload() {
  const file = selectedCoverFile.value
  if (!file) {
    message.warning('请先选择封面图片')
    return
  }
  coverUploading.value = true
  try {
    const data = await uploadAdminArticleCover({
      file,
      source_markdown_path: formState.source_markdown_path.trim() || undefined,
    })
    formState.cover_path = data.cover_path
    message.success('封面图片上传成功')
  } catch {
    message.error('封面图片上传失败')
  } finally {
    coverUploading.value = false
  }
}

function handleLocalFilesChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  selectedLocalFiles.value = mergeLocalImageFiles(selectedLocalFiles.value, files)
  input.value = ''
}

function handleLocalDirectoryChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  selectedLocalFiles.value = mergeLocalImageFiles(selectedLocalFiles.value, files)
  input.value = ''
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

function isRemoteHttpImage(src: string): boolean {
  return /^https?:\/\//i.test((src || '').trim())
}

function isCsdnImageHost(src: string): boolean {
  try {
    const host = new URL(src).hostname.toLowerCase()
    return host === 'csdnimg.cn' || host.endsWith('.csdnimg.cn')
  } catch {
    return false
  }
}

function buildImageProxyUrl(remoteImageUrl: string): string {
  try {
    const url = new URL(remoteImageUrl)
    url.hash = ''
    return `${BACKEND_ORIGIN}/api/v1/image-proxy/?url=${encodeURIComponent(url.toString())}`
  } catch {
    const noHash = remoteImageUrl.split('#', 1)[0] || remoteImageUrl
    return `${BACKEND_ORIGIN}/api/v1/image-proxy/?url=${encodeURIComponent(noHash)}`
  }
}

function rewriteCsdnImageSrcInHtml(html: string): string {
  if (!html) return html
  return html.replace(HTML_IMAGE_SRC_PATTERN, (_, prefix: string, src: string, suffix: string) => {
    if (!isRemoteHttpImage(src) || !isCsdnImageHost(src)) return `${prefix}${src}${suffix}`
    return `${prefix}${buildImageProxyUrl(src)}${suffix}`
  })
}

const previewHtml = computed(() => {
  const rendered = renderMarkdownContent(formState.markdown_content || '')
  return rewriteCsdnImageSrcInHtml(rendered.html)
})

const previewContainerRef = ref<HTMLElement | null>(null)

watch(
  previewHtml,
  async () => {
    await nextTick()
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
  },
  { immediate: true },
)

async function handleConfirm() {
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

  emit('submit', payload)
}

function handleSkipUploadAndSubmit() {
  const payload = pendingSubmitPayload.value
  resetLocalImageDialog()
  if (payload) {
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
            <a-select v-model:value="formState.category" allow-clear :options="categoryOptions" placeholder="选择分类" />
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
              <input type="file" accept="image/*" @change="handleCoverFileSelected" />
              <a-button type="default" size="small" :loading="coverUploading" @click="handleCoverFileUpload">上传封面</a-button>
            </div>
            <img v-if="coverPreview" :src="coverPreview" alt="cover preview" class="cover-preview" />
          </a-form-item>
        </div>

        <a-form-item>
          <a-checkbox v-model:checked="formState.is_pinned">置顶文章</a-checkbox>
        </a-form-item>

        <div class="editor-columns">
          <section class="editor-column">
            <a-form-item label="Markdown 正文" name="markdown_content">
              <div class="upload-line">
                <input type="file" accept=".md,.markdown,.txt,.html,.htm" @change="handleMarkdownFileSelected" />
                <a-button type="default" size="small" :loading="markdownFileUploading" @click="handleMarkdownFileUpload">
                  上传并解析 Markdown
                </a-button>
              </div>
              <a-textarea v-model:value="formState.markdown_content" :auto-size="{ minRows: 22, maxRows: 42 }" />
              <div v-if="detectedLocalRefs.length" class="local-image-tip">
                检测到 {{ detectedLocalRefs.length }} 处本地图片引用，提交时将提示上传并自动处理引用路径。
              </div>
            </a-form-item>
          </section>

          <section class="editor-column preview-column">
            <h3 class="preview-title">实时预览</h3>
            <div v-if="!formState.markdown_content.trim()" class="preview-empty">在左侧输入 Markdown 后，这里会实时渲染结果。</div>
            <article v-else ref="previewContainerRef" class="preview-markdown markdown-body" v-html="previewHtml" />
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
      <input type="file" multiple accept="image/*" @change="handleLocalFilesChange" />
      <input type="file" webkitdirectory directory multiple accept="image/*" @change="handleLocalDirectoryChange" />
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

.editor-page {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.head-title h2 {
  margin: 0;
  color: var(--text);
  font-size: 1.35rem;
}

.head-title p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.86rem;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

.asset-item {
  min-width: 0;
}

.editor-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.editor-column {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: color-mix(in srgb, var(--surface-2) 35%, var(--surface));
}

.preview-column {
  position: sticky;
  top: 12px;
}

.preview-title {
  margin: 0 0 10px;
  color: var(--text);
  font-size: 0.98rem;
}

.preview-empty {
  color: var(--muted);
  font-size: 0.86rem;
  min-height: 12rem;
  display: flex;
  align-items: center;
}

.preview-markdown {
  max-height: min(70vh, 46rem);
  overflow: auto;
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface) 88%, white 12%);
  border: 1px solid var(--border);
  padding: 14px;
}

.preview-markdown :deep(img) {
  max-width: 100%;
  height: auto;
}

.local-image-tip {
  margin-top: 8px;
  color: var(--btn-warning);
  font-size: 12px;
}

.upload-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.cover-preview {
  margin-top: 8px;
  width: min(100%, 12rem);
  max-width: 100%;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.selected-files {
  margin-top: 8px;
  color: var(--muted);
}

.mapping-warning {
  margin-top: 8px;
  color: var(--btn-danger);
}

.ref-list {
  margin-top: 12px;
  max-height: min(48vh, 16rem);
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
}

.ref-list ul {
  margin-bottom: 0;
  padding-left: 20px;
}

.ref-list li {
  line-height: 1.8;
}

.ref-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.ref-status {
  border-radius: 4px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 18px;
}

.ref-status--matched {
  color: var(--btn-success);
  background: color-mix(in srgb, var(--btn-success) 16%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--btn-success) 45%, var(--border));
}

.ref-status--unmatched {
  color: var(--btn-warning);
  background: color-mix(in srgb, var(--btn-warning) 16%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--btn-warning) 42%, var(--border));
}

.ref-status--ambiguous {
  color: var(--btn-danger);
  background: color-mix(in srgb, var(--btn-danger) 16%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--btn-danger) 42%, var(--border));
}

.ref-detail {
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 1080px) {
  .meta-grid,
  .asset-grid,
  .editor-columns {
    grid-template-columns: minmax(0, 1fr);
  }

  .preview-column {
    position: static;
  }
}
</style>

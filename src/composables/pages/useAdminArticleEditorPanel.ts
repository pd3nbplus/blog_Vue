import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { FormInstance } from 'ant-design-vue'
import type { Rule } from 'ant-design-vue/es/form'
import type { UploadProps } from 'ant-design-vue'
import {
  resolveAdminArticleLocalImages,
  uploadAdminArticleCover,
} from '@/services/api/adminArticle'
import {
  useAdminArticlePreview,
  type MarkdownTextareaRefInstance,
} from '@/composables/pages/useAdminArticlePreview'
import type { AdminArticlePayload, ArticleStatus, CategoryItem } from '@/types/article'
import { ARTICLE_STATUS_OPTIONS } from '@/utils/articleStatus'
import { BACKEND_ORIGIN, resolveTempAsset } from '@/utils/assets'
import { matchLocalImageRefs, mergeLocalImageFiles } from '@/utils/localImageMapping'
import { extractLocalImageRefs } from '@/utils/markdownLocalImage'
interface AdminArticleFormInput {
  title: string
  slug: string
  summary: string
  markdown_content: string
  source_markdown_path: string
  cover_path: string
  category: number | null
  status: ArticleStatus
  is_pinned: boolean
}
interface CategoryTreeSelectNode {
  title: string
  value: number
  key: number
  selectable: boolean
  children?: CategoryTreeSelectNode[]
}
export interface AdminArticleEditorPanelProps {
  initialValue?: Partial<AdminArticlePayload> | null
  categoryTree: CategoryItem[]
}
// Keep rich inferred return types for template consumers without duplicating a massive interface.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useAdminArticleEditorPanel(
  props: AdminArticleEditorPanelProps,
  emitSubmit: (value: AdminArticlePayload) => void,
) {
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
  const statusOptions = ARTICLE_STATUS_OPTIONS
  const rules = computed<Record<string, Rule[]>>(() => ({
    title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
    slug: [{ required: true, message: '请输入 slug', trigger: 'blur' }],
    markdown_content: [{ required: true, message: '请输入 Markdown 正文', trigger: 'blur' }],
  }))
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
  const markdownTextareaRef = ref<MarkdownTextareaRefInstance | null>(null)
  const previewScrollRef = ref<HTMLElement | null>(null)
  const previewContainerRef = ref<HTMLElement | null>(null)
  const expandedParentCategoryId = ref<number | null>(null)
  function resetForm(): void {
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
  function syncFormFromInitialValue(): void {
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
  function resetLocalImageDialog(): void {
    pendingSubmitPayload.value = null
    pendingLocalRefs.value = []
    selectedLocalFiles.value = []
    localImageDialogOpen.value = false
  }
  function resetAssetSelectionState(): void {
    selectedMarkdownFile.value = null
    markdownUploadList.value = []
    selectedCoverFile.value = null
    coverUploadList.value = []
    if (localCoverPreviewUrl.value) {
      URL.revokeObjectURL(localCoverPreviewUrl.value)
      localCoverPreviewUrl.value = ''
    }
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
    return `/media/articles/uploads/${dateDir}/${safeStem}.md`
  }
  async function readTextFromFile(file: File): Promise<string> {
    return file.text()
  }
  async function applyMarkdownFileToForm(file: File): Promise<void> {
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
  function clearSelectedLocalFiles(): void {
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
  const { previewHtml, handlePreviewScroll } = useAdminArticlePreview({
    markdownContent: computed(() => formState.markdown_content),
    markdownTextareaRef,
    previewScrollRef,
    previewContainerRef,
  })
  async function handleConfirm(): Promise<void> {
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
    emitSubmit(payload)
  }
  async function handleSkipUploadAndSubmit(): Promise<void> {
    const payload = pendingSubmitPayload.value
    resetLocalImageDialog()
    if (payload) {
      const uploaded = await uploadCoverBeforeSubmit(payload)
      if (!uploaded) return
      emitSubmit(payload)
    }
  }
  async function handleUploadAndSubmit(): Promise<void> {
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
        const unresolved = new Set<string>([
          ...unmatchedRefs,
          ...ambiguousRefs,
          ...(result.unresolved_refs || []),
        ])
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
        message.warning(
          `未匹配到可上传图片（未匹配 ${unmatchedRefs.length}，冲突 ${ambiguousRefs.length}），将直接提交`,
        )
      } else {
        message.info('未选择图片文件，已直接提交文章')
      }
    }
    const submitPayload = { ...payload }
    resetLocalImageDialog()
    const uploaded = await uploadCoverBeforeSubmit(submitPayload)
    if (!uploaded) return
    emitSubmit(submitPayload)
  }
  watch(
    () => props.initialValue,
    () => {
      syncFormFromInitialValue()
      resetAssetSelectionState()
    },
    { immediate: true },
  )
  onBeforeUnmount(() => {
    resetAssetSelectionState()
  })
  return {
    formState,
    statusOptions,
    rules,
    formRef,
    markdownTextareaRef,
    previewScrollRef,
    previewContainerRef,
    categoryTreeData,
    categoryExpandedKeys,
    handleCategoryDropdownVisibleChange,
    handleCategoryTreeExpand,
    handleConfirm,
    handleSkipUploadAndSubmit,
    handleUploadAndSubmit,
    handlePreviewScroll,
    previewHtml,
    markdownFileUploading,
    markdownUploadList,
    handleMarkdownBeforeUpload,
    handleMarkdownRemove,
    coverUploading,
    coverUploadList,
    coverPreview,
    handleCoverBeforeUpload,
    handleCoverRemove,
    detectedLocalRefs,
    localImageDialogOpen,
    localImageSubmitting,
    pendingLocalRefs,
    selectedLocalFiles,
    localImageMatchResult,
    localImageMatchStats,
    sourceMarkdownPathMissingForUpload,
    handleLocalFilesBeforeUpload,
    handleLocalDirectoryBeforeUpload,
    clearSelectedLocalFiles,
    getPreviewStatusText,
  }
}

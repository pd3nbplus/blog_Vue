import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
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
  editing?: boolean
}

const CREATE_ARTICLE_DRAFT_STORAGE_KEY = 'blog_vue_admin_article_create_draft_v1'
const CREATE_ARTICLE_DRAFT_CLEAR_ONCE_STORAGE_KEY = 'blog_vue_admin_article_create_draft_clear_once_v1'
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
  let draftPersistTimer: ReturnType<typeof setTimeout> | null = null

  function clearDraftPersistTimer(): void {
    if (!draftPersistTimer) return
    clearTimeout(draftPersistTimer)
    draftPersistTimer = null
  }

  function flushCreateDraftPersist(): void {
    clearDraftPersistTimer()
    persistCreateDraft()
  }

  function getFormSnapshot(): AdminArticleFormInput {
    return {
      title: formState.title,
      slug: formState.slug,
      summary: formState.summary,
      markdown_content: formState.markdown_content,
      source_markdown_path: formState.source_markdown_path,
      cover_path: formState.cover_path,
      category: formState.category,
      status: formState.status,
      is_pinned: formState.is_pinned,
    }
  }

  function hasDraftContent(snapshot: AdminArticleFormInput): boolean {
    if (snapshot.title.trim()) return true
    if (snapshot.slug.trim()) return true
    if (snapshot.summary.trim()) return true
    if (snapshot.markdown_content.trim()) return true
    if (snapshot.source_markdown_path.trim()) return true
    if (snapshot.cover_path.trim()) return true
    if (snapshot.category !== null) return true
    if (snapshot.status !== 'draft') return true
    return snapshot.is_pinned
  }

  function persistCreateDraft(): void {
    if (props.editing) return
    if (typeof window === 'undefined') return
    const snapshot = getFormSnapshot()
    if (!hasDraftContent(snapshot)) {
      window.localStorage.removeItem(CREATE_ARTICLE_DRAFT_STORAGE_KEY)
      return
    }
    try {
      window.localStorage.setItem(
        CREATE_ARTICLE_DRAFT_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          form: snapshot,
        }),
      )
    } catch {
      // Ignore localStorage write failures.
    }
  }

  function schedulePersistCreateDraft(): void {
    if (props.editing) return
    clearDraftPersistTimer()
    draftPersistTimer = setTimeout(() => {
      persistCreateDraft()
      draftPersistTimer = null
    }, 220)
  }

  function restoreCreateDraft(): void {
    if (props.editing) return
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(CREATE_ARTICLE_DRAFT_STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as {
        version?: number
        form?: Partial<AdminArticleFormInput>
      }
      const form = parsed?.form
      if (!form || typeof form !== 'object') return
      formState.title = typeof form.title === 'string' ? form.title : ''
      formState.slug = typeof form.slug === 'string' ? form.slug : ''
      formState.summary = typeof form.summary === 'string' ? form.summary : ''
      formState.markdown_content = typeof form.markdown_content === 'string' ? form.markdown_content : ''
      formState.source_markdown_path = typeof form.source_markdown_path === 'string' ? form.source_markdown_path : ''
      formState.cover_path = typeof form.cover_path === 'string' ? form.cover_path : ''
      formState.category = typeof form.category === 'number' ? form.category : null
      formState.status =
        form.status === 'draft' || form.status === 'published' || form.status === 'archived'
          ? form.status
          : 'draft'
      formState.is_pinned = form.is_pinned === true
    } catch {
      window.localStorage.removeItem(CREATE_ARTICLE_DRAFT_STORAGE_KEY)
    }
  }

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
    if (!props.initialValue) {
      restoreCreateDraft()
      return
    }
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
  function handleCategoryTreeExpand(expandedKeys: Array<string | number>): void {
    const expandedTopLevelKeys = expandedKeys
      .map((key) => Number(key))
      .filter((key) => Number.isFinite(key) && key > 0 && topLevelCategoryIdSet.value.has(key))

    expandedParentCategoryId.value = expandedTopLevelKeys.length
      ? (expandedTopLevelKeys[expandedTopLevelKeys.length - 1] ?? null)
      : null
  }
  function extractMarkdownBaseName(filename: string): string {
    const normalized = filename.split('/').pop()?.split('\\').pop() || filename
    return normalized.replace(/\.[^./\\]+$/, '').trim()
  }
  async function readTextFromFile(file: File): Promise<string> {
    return file.text()
  }
  async function applyMarkdownFileToForm(file: File): Promise<void> {
    markdownFileUploading.value = true
    try {
      const text = await readTextFromFile(file)
      formState.markdown_content = text
      await nextTick()
      formRef.value?.clearValidate?.(['markdown_content'])
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
        title: payload.title.trim(),
        category: payload.category,
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
    flushCreateDraftPersist()
    const payload: AdminArticlePayload = {
      title: formState.title.trim(),
      slug: formState.slug.trim(),
      summary: formState.summary.trim(),
      markdown_content: formState.markdown_content,
      source_markdown_path: '',
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
    resetLocalImageDialog()
    message.info('请先上传并匹配本地图片后再发布')
  }
  async function handleUploadAndSubmit(): Promise<void> {
    const payload = pendingSubmitPayload.value
    if (!payload) return
    const { mappings, unmatchedRefs, ambiguousRefs } = localImageMatchResult.value
    if (selectedLocalFiles.value.length <= 0 || mappings.length <= 0) {
      message.error('检测到本地图片引用，请先选择并匹配图片文件后再发布')
      return
    }
    if (unmatchedRefs.length > 0 || ambiguousRefs.length > 0) {
      message.error(
        `仍有图片引用未处理（未匹配 ${unmatchedRefs.length}，冲突 ${ambiguousRefs.length}），请补齐后再发布`,
      )
      return
    }
    localImageSubmitting.value = true
    try {
      const result = await resolveAdminArticleLocalImages({
        markdown_content: payload.markdown_content,
        source_markdown_path: '',
        mappings,
      })
      payload.markdown_content = result.markdown_content
      payload.source_markdown_path = ''
      const unresolved = new Set<string>(result.unresolved_refs || [])
      if (unresolved.size > 0) {
        const sample = Array.from(unresolved).slice(0, 2).join('、')
        message.error(`本地图片仍有 ${unresolved.size} 处未处理：${sample}${unresolved.size > 2 ? '…' : ''}`)
        return
      }
      message.success(`本地图片处理完成，已上传 ${result.uploaded.length} 个文件并重写引用`)
    } catch {
      message.error('本地图片上传失败，请重试')
      return
    } finally {
      localImageSubmitting.value = false
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
  watch(
    () => [
      props.editing,
      formState.title,
      formState.slug,
      formState.summary,
      formState.markdown_content,
      formState.source_markdown_path,
      formState.cover_path,
      formState.category,
      formState.status,
      formState.is_pinned,
    ],
    () => {
      schedulePersistCreateDraft()
    },
  )
  onBeforeUnmount(() => {
    const shouldSkipPersistOnUnmount =
      !props.editing &&
      typeof window !== 'undefined' &&
      window.localStorage.getItem(CREATE_ARTICLE_DRAFT_CLEAR_ONCE_STORAGE_KEY) === '1'

    if (shouldSkipPersistOnUnmount && typeof window !== 'undefined') {
      window.localStorage.removeItem(CREATE_ARTICLE_DRAFT_CLEAR_ONCE_STORAGE_KEY)
      window.localStorage.removeItem(CREATE_ARTICLE_DRAFT_STORAGE_KEY)
    }

    if (draftPersistTimer) {
      clearDraftPersistTimer()
      if (!shouldSkipPersistOnUnmount) {
        persistCreateDraft()
      }
    } else if (!shouldSkipPersistOnUnmount) {
      persistCreateDraft()
    }
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
    handleLocalFilesBeforeUpload,
    handleLocalDirectoryBeforeUpload,
    clearSelectedLocalFiles,
    getPreviewStatusText,
  }
}

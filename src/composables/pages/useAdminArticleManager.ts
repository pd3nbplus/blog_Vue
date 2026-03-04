import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

import { useFeedback } from '@/composables/useFeedback'
import { getCategoryTree } from '@/services/article'
import type { AdminArticleOrderingDirection, AdminArticleOrderingField } from '@/services/adminArticle'
import { useAdminArticleStore } from '@/stores/modules/adminArticle'
import type { AdminArticlePayload, ArticleStatus, CategoryItem } from '@/types/article'
import { flattenCategoryTreeToOptions } from '@/utils/article'

const FIXED_PAGE_SIZE = 15
const KEYWORD_DEBOUNCE_MS = 420
const ORDERING_FIELDS: AdminArticleOrderingField[] = ['updated_at', 'created_at', 'published_at', 'view_count', 'title', 'status']
const DEFAULT_ORDERING_FIELD: AdminArticleOrderingField = 'published_at'
const DEFAULT_ORDERING_DIRECTION: AdminArticleOrderingDirection = 'desc'
type AntSortOrder = 'ascend' | 'descend' | null

export function useAdminArticleManager() {
  const adminArticleStore = useAdminArticleStore()
  const feedback = useFeedback()
  const route = useRoute()
  const router = useRouter()
  const { loading, submitting, list, total, page, pageSize } = storeToRefs(adminArticleStore)

  const keyword = ref('')
  const statusFilter = ref<ArticleStatus | undefined>(undefined)
  const categoryFilter = ref<number | undefined>(undefined)
  const orderingField = ref<AdminArticleOrderingField>(DEFAULT_ORDERING_FIELD)
  const orderingDirection = ref<AdminArticleOrderingDirection>(DEFAULT_ORDERING_DIRECTION)

  const categories = ref<CategoryItem[]>([])
  const categoryOptions = computed(() => flattenCategoryTreeToOptions(categories.value))
  const categoryPathMap = computed(() => {
    const map = new Map<number, string>()
    const walk = (nodes: CategoryItem[], parentPath: string | null) => {
      for (const node of nodes) {
        const path = parentPath ? `${parentPath} - ${node.name}` : node.name
        map.set(node.id, path)
        if (node.children?.length) {
          walk(node.children, path)
        }
      }
    }
    walk(categories.value, null)
    return map
  })

  const editorLoading = ref(false)
  const editingId = ref<number | null>(null)
  const editingFormValue = ref<Partial<AdminArticlePayload> | null>(null)
  let keywordSearchTimer: ReturnType<typeof setTimeout> | null = null

  const statusOptions: Array<{ label: string; value: ArticleStatus }> = [
    { label: '草稿', value: 'draft' },
    { label: '已发布', value: 'published' },
    { label: '已归档', value: 'archived' },
  ]
  const orderingValue = computed<`${'' | '-'}${AdminArticleOrderingField}`>(() => {
    const prefix = orderingDirection.value === 'desc' ? '-' : ''
    return `${prefix}${orderingField.value}` as `${'' | '-'}${AdminArticleOrderingField}`
  })

  function parseOrdering(rawOrdering: string | undefined): {
    field: AdminArticleOrderingField
    direction: AdminArticleOrderingDirection
  } {
    const raw = (rawOrdering || '').trim()
    if (!raw) {
      return { field: DEFAULT_ORDERING_FIELD, direction: DEFAULT_ORDERING_DIRECTION }
    }
    const direction: AdminArticleOrderingDirection = raw.startsWith('-') ? 'desc' : 'asc'
    const field = (raw.startsWith('-') ? raw.slice(1) : raw) as AdminArticleOrderingField
    if (!ORDERING_FIELDS.includes(field)) {
      return { field: DEFAULT_ORDERING_FIELD, direction: DEFAULT_ORDERING_DIRECTION }
    }
    return { field, direction }
  }

  function syncFilterFromRoute() {
    const q = route.query.q
    const status = route.query.status
    const category = route.query.category
    const ordering = route.query.ordering
    const currentPage = Number(route.query.page || 1)

    keyword.value = typeof q === 'string' ? q : ''
    if (status === 'draft' || status === 'published' || status === 'archived') {
      statusFilter.value = status
    } else {
      statusFilter.value = undefined
    }
    const categoryId = Number(category)
    categoryFilter.value = Number.isNaN(categoryId) || categoryId <= 0 ? undefined : categoryId
    const { field, direction } = parseOrdering(typeof ordering === 'string' ? ordering : undefined)
    orderingField.value = field
    orderingDirection.value = direction
    page.value = Number.isNaN(currentPage) ? 1 : Math.max(1, currentPage)
    pageSize.value = FIXED_PAGE_SIZE
  }

  async function syncRouteQuery(currentPage: number) {
    const q = keyword.value.trim()
    const status = statusFilter.value
    const category = categoryFilter.value
    await router.replace({
      path: '/admin/manage_articles/',
      query: {
        page: String(currentPage),
        page_size: String(FIXED_PAGE_SIZE),
        ordering: orderingValue.value,
        ...(q ? { q } : {}),
        ...(status ? { status } : {}),
        ...(category ? { category: String(category) } : {}),
      },
    })
  }

  async function fetchList(currentPage = 1, syncQuery = false) {
    if (syncQuery) {
      await syncRouteQuery(currentPage)
    }
    try {
      await adminArticleStore.fetchList({
        page: currentPage,
        page_size: FIXED_PAGE_SIZE,
        q: keyword.value.trim() || undefined,
        status: statusFilter.value,
        category: categoryFilter.value,
        ordering: orderingValue.value,
      })
    } catch (error) {
      feedback.error(error)
    }
  }

  async function fetchCategories() {
    try {
      const res = await getCategoryTree()
      categories.value = res.data
    } catch (error) {
      feedback.error(error)
    }
  }

  function handlePageChange(currentPage: number) {
    void fetchList(currentPage, true)
  }

  function clearKeywordSearchTimer() {
    if (!keywordSearchTimer) return
    clearTimeout(keywordSearchTimer)
    keywordSearchTimer = null
  }

  function handleKeywordInput(value: string) {
    keyword.value = value
    clearKeywordSearchTimer()
    keywordSearchTimer = setTimeout(() => {
      void fetchList(1, true)
    }, KEYWORD_DEBOUNCE_MS)
  }

  function handleKeywordEnter() {
    clearKeywordSearchTimer()
    void fetchList(1, true)
  }

  function applyFilters() {
    clearKeywordSearchTimer()
    void fetchList(1, true)
  }

  function resetFilters() {
    clearKeywordSearchTimer()
    keyword.value = ''
    statusFilter.value = undefined
    categoryFilter.value = undefined
    orderingField.value = DEFAULT_ORDERING_FIELD
    orderingDirection.value = DEFAULT_ORDERING_DIRECTION
    void fetchList(1, true)
  }

  function formatCategoryPath(category: CategoryItem | null | undefined): string {
    if (!category) return '未分类'
    return categoryPathMap.value.get(category.id) || category.name
  }

  function getSortOrder(field: AdminArticleOrderingField): AntSortOrder {
    if (orderingField.value !== field) return null
    return orderingDirection.value === 'asc' ? 'ascend' : 'descend'
  }

  function handleTableSortChange(field: AdminArticleOrderingField | undefined, order: AntSortOrder): void {
    if (!field || !order) {
      orderingField.value = DEFAULT_ORDERING_FIELD
      orderingDirection.value = DEFAULT_ORDERING_DIRECTION
      void fetchList(1, true)
      return
    }
    orderingField.value = field
    orderingDirection.value = order === 'ascend' ? 'asc' : 'desc'
    void fetchList(1, true)
  }

  function setupCreateEditor() {
    editingId.value = null
    editingFormValue.value = null
  }

  async function setupEditEditor(id: number) {
    editorLoading.value = true
    try {
      const detail = await adminArticleStore.fetchDetail(id)
      editingId.value = id
      editingFormValue.value = {
        title: detail.title,
        slug: detail.slug,
        summary: detail.summary,
        markdown_content: detail.markdown_content,
        source_markdown_path: detail.source_markdown_path || '',
        cover_path: detail.cover_path || '',
        category: detail.category?.id ?? null,
        status: detail.status,
        is_pinned: detail.is_pinned ?? false,
      }
    } catch (error) {
      feedback.error(error)
      await router.replace('/admin/manage_articles/?page=1&page_size=15&ordering=-published_at')
    } finally {
      editorLoading.value = false
    }
  }

  async function setupEditorFromRoute() {
    if (route.path === '/admin/create_article/') {
      setupCreateEditor()
      return
    }

    const rawId = route.params.articleId
    if (!rawId) return
    const id = Number(rawId)
    if (Number.isNaN(id) || id <= 0) return
    if (editingId.value === id && editingFormValue.value) return
    await setupEditEditor(id)
  }

  async function handleSubmit(payload: AdminArticlePayload) {
    try {
      if (editingId.value) {
        await adminArticleStore.updateArticle(editingId.value, payload)
        feedback.success('文章更新成功')
      } else {
        await adminArticleStore.createArticle(payload)
        feedback.success('文章创建成功')
      }
      if (route.path.startsWith('/admin/create_article/')) {
        await router.replace('/admin/manage_articles/?page=1&page_size=15&ordering=-published_at')
        await fetchList(1)
      } else {
        await fetchList(page.value, true)
      }
    } catch (error) {
      feedback.error(error)
    }
  }

  async function handleArchive(id: number) {
    try {
      await adminArticleStore.archiveArticle(id)
      feedback.success('文章删除成功')
      await fetchList(page.value, true)
    } catch (error) {
      feedback.error(error)
    }
  }

  async function handleCancelEditor() {
    await router.replace('/admin/manage_articles/?page=1&page_size=15&ordering=-published_at')
  }

  onMounted(async () => {
    syncFilterFromRoute()
    await fetchCategories()
  })

  onBeforeUnmount(() => {
    clearKeywordSearchTimer()
  })

  watch(
    () => route.fullPath,
    () => {
      syncFilterFromRoute()
      if (route.path === '/admin/manage_articles/') {
        void fetchList(page.value)
      }
      if (route.path.startsWith('/admin/create_article/')) {
        void setupEditorFromRoute()
      }
    },
    { immediate: true },
  )

  return {
    loading,
    submitting,
    editorLoading,
    categories,
    list,
    total,
    page,
    pageSize,
    keyword,
    statusFilter,
    categoryFilter,
    handleKeywordInput,
    handleKeywordEnter,
    statusOptions,
    categoryOptions,
    editingId,
    editingFormValue,
    formatCategoryPath,
    getSortOrder,
    handleTableSortChange,
    fetchList,
    handlePageChange,
    applyFilters,
    resetFilters,
    handleSubmit,
    handleArchive,
    handleCancelEditor,
  }
}

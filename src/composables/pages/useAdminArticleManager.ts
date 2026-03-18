import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

import { useFeedback } from '@/composables/useFeedback'
import { getCategoryTree } from '@/services/api/article'
import type { AdminArticleOrderingDirection, AdminArticleOrderingField } from '@/services/api/adminArticle'
import {
  getAdminCollectionDetail,
  getAdminCollectionList,
  updateAdminCollection,
} from '@/services/api/adminCollection'
import { useAdminArticleStore } from '@/stores/modules/adminArticle'
import type {
  AdminArticlePayload,
  ArticleItem,
  ArticleStatus,
  CategoryItem,
  CollectionDetail,
  CollectionItem,
} from '@/types/article'
import { ARTICLE_STATUS_OPTIONS, isArticleStatus } from '@/utils/articleStatus'
import { flattenCategoryTreeToOptions } from '@/utils/article'

const FIXED_PAGE_SIZE = 15
const KEYWORD_DEBOUNCE_MS = 420
const ORDERING_FIELDS: AdminArticleOrderingField[] = ['updated_at', 'created_at', 'published_at', 'view_count', 'title', 'status']
const DEFAULT_ORDERING_FIELD: AdminArticleOrderingField = 'published_at'
const DEFAULT_ORDERING_DIRECTION: AdminArticleOrderingDirection = 'desc'
const CREATE_ARTICLE_DRAFT_STORAGE_KEY = 'blog_vue_admin_article_create_draft_v1'
const CREATE_ARTICLE_DRAFT_CLEAR_ONCE_STORAGE_KEY = 'blog_vue_admin_article_create_draft_clear_once_v1'
type AntSortOrder = 'ascend' | 'descend' | null

// Keep inferred return object types for downstream usage without duplicating a large interface.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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
    const walk = (nodes: CategoryItem[], parentPath: string | null): void => {
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
  const collectionBindingOpen = ref(false)
  const collectionBindingLoading = ref(false)
  const collectionBindingSubmitting = ref(false)
  const collectionBindingArticleId = ref<number | null>(null)
  const collectionBindingArticleTitle = ref('')
  const collectionBindingValue = ref<number[]>([])
  const collectionBindingOptions = ref<Array<{ label: string; value: number }>>([])
  const collectionDetailsMap = ref<Record<number, CollectionDetail>>({})
  let keywordSearchTimer: ReturnType<typeof setTimeout> | null = null
  let collectionBindingLoadToken = 0

  const statusOptions = ARTICLE_STATUS_OPTIONS
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

  function syncFilterFromRoute(): void {
    const q = route.query.q
    const status = route.query.status
    const category = route.query.category
    const ordering = route.query.ordering
    const currentPageRaw = Array.isArray(route.query.page) ? route.query.page[0] : route.query.page
    const currentPage = Number(currentPageRaw || 1)

    keyword.value = typeof q === 'string' ? q : ''
    const statusValue = Array.isArray(status) ? status[0] : status
    if (isArticleStatus(statusValue)) {
      statusFilter.value = statusValue
    } else {
      statusFilter.value = undefined
    }
    const categoryValue = Array.isArray(category) ? category[0] : category
    const categoryId = Number(categoryValue)
    categoryFilter.value = Number.isNaN(categoryId) || categoryId <= 0 ? undefined : categoryId
    const orderingValue = Array.isArray(ordering) ? ordering[0] : ordering
    const { field, direction } = parseOrdering(typeof orderingValue === 'string' ? orderingValue : undefined)
    orderingField.value = field
    orderingDirection.value = direction
    page.value = Number.isNaN(currentPage) ? 1 : Math.max(1, currentPage)
    pageSize.value = FIXED_PAGE_SIZE
  }

  async function syncRouteQuery(currentPage: number): Promise<void> {
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

  async function fetchList(currentPage = 1, syncQuery = false): Promise<void> {
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

  async function fetchCategories(): Promise<void> {
    try {
      const res = await getCategoryTree()
      categories.value = res.data
    } catch (error) {
      feedback.error(error)
    }
  }

  function handlePageChange(currentPage: number): void {
    void fetchList(currentPage, true)
  }

  function clearKeywordSearchTimer(): void {
    if (!keywordSearchTimer) return
    clearTimeout(keywordSearchTimer)
    keywordSearchTimer = null
  }

  function handleKeywordInput(value: string): void {
    keyword.value = value
    clearKeywordSearchTimer()
    keywordSearchTimer = setTimeout(() => {
      void fetchList(1, true)
    }, KEYWORD_DEBOUNCE_MS)
  }

  function handleKeywordEnter(): void {
    clearKeywordSearchTimer()
    void fetchList(1, true)
  }

  function applyFilters(): void {
    clearKeywordSearchTimer()
    void fetchList(1, true)
  }

  function resetFilters(): void {
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

  function setupCreateEditor(): void {
    editingId.value = null
    editingFormValue.value = null
  }

  async function setupEditEditor(id: number): Promise<void> {
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

  async function setupEditorFromRoute(): Promise<void> {
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

  async function handleSubmit(payload: AdminArticlePayload): Promise<void> {
    try {
      if (editingId.value) {
        await adminArticleStore.updateArticle(editingId.value, payload)
        feedback.success('文章更新成功')
      } else {
        await adminArticleStore.createArticle(payload)
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(CREATE_ARTICLE_DRAFT_STORAGE_KEY)
          window.localStorage.setItem(CREATE_ARTICLE_DRAFT_CLEAR_ONCE_STORAGE_KEY, '1')
        }
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

  async function handleArchive(id: number): Promise<void> {
    try {
      await adminArticleStore.archiveArticle(id)
      feedback.success('文章删除成功')
      await fetchList(page.value, true)
    } catch (error) {
      feedback.error(error)
    }
  }

  async function handleCancelEditor(): Promise<void> {
    await router.replace('/admin/manage_articles/?page=1&page_size=15&ordering=-published_at')
  }

  async function fetchAllCollections(): Promise<CollectionItem[]> {
    const merged: CollectionItem[] = []
    let currentPage = 1
    let totalPages = 1

    while (currentPage <= totalPages) {
      const response = await getAdminCollectionList({
        page: currentPage,
        page_size: 100,
        ordering: 'name',
      })
      merged.push(...response.results)
      totalPages = Math.max(1, response.num_pages || 1)
      currentPage += 1
    }
    return merged
  }

  async function handleOpenCollectionBinding(article: ArticleItem): Promise<void> {
    collectionBindingOpen.value = true
    collectionBindingLoading.value = true
    collectionBindingArticleId.value = article.id
    collectionBindingArticleTitle.value = article.title || ''
    collectionBindingValue.value = []

    const loadToken = ++collectionBindingLoadToken
    try {
      const collections = await fetchAllCollections()
      if (loadToken !== collectionBindingLoadToken) return

      collectionBindingOptions.value = collections.map((item) => ({
        label: `${item.name} (#${item.id})`,
        value: item.id,
      }))

      const detailList = await Promise.all(
        collections.map(async (item) => {
          try {
            return await getAdminCollectionDetail(item.id)
          } catch {
            return null
          }
        }),
      )
      if (loadToken !== collectionBindingLoadToken) return

      const detailsMap: Record<number, CollectionDetail> = {}
      const selectedCollectionIds: number[] = []
      for (const detail of detailList) {
        if (!detail) continue
        detailsMap[detail.id] = detail
        if (detail.article_ids.includes(article.id)) {
          selectedCollectionIds.push(detail.id)
        }
      }
      collectionDetailsMap.value = detailsMap
      collectionBindingValue.value = selectedCollectionIds
    } catch (error) {
      feedback.error(error, '加载合集归属失败')
    } finally {
      if (loadToken === collectionBindingLoadToken) {
        collectionBindingLoading.value = false
      }
    }
  }

  function handleCloseCollectionBinding(): void {
    collectionBindingLoadToken += 1
    collectionBindingOpen.value = false
    collectionBindingLoading.value = false
    collectionBindingSubmitting.value = false
    collectionBindingArticleId.value = null
    collectionBindingArticleTitle.value = ''
    collectionBindingValue.value = []
    collectionBindingOptions.value = []
    collectionDetailsMap.value = {}
  }

  async function handleSaveCollectionBinding(): Promise<void> {
    const articleId = collectionBindingArticleId.value
    if (!articleId) return

    const selectedSet = new Set(collectionBindingValue.value)
    const updates = Object.values(collectionDetailsMap.value)
      .map((detail) => {
        const currentHas = detail.article_ids.includes(articleId)
        const targetHas = selectedSet.has(detail.id)
        if (currentHas === targetHas) return null

        const nextIds = targetHas
          ? Array.from(new Set([...detail.article_ids, articleId]))
          : detail.article_ids.filter((id) => id !== articleId)
        return { id: detail.id, articleIds: nextIds }
      })
      .filter((item): item is { id: number; articleIds: number[] } => Boolean(item))

    if (!updates.length) {
      feedback.success('合集归属未变化')
      handleCloseCollectionBinding()
      return
    }

    collectionBindingSubmitting.value = true
    try {
      await Promise.all(
        updates.map((item) =>
          updateAdminCollection(item.id, {
            article_ids: item.articleIds,
          }),
        ),
      )
      feedback.success('合集归属更新成功')
      handleCloseCollectionBinding()
      await fetchList(page.value, true)
    } catch (error) {
      feedback.error(error, '更新合集归属失败')
    } finally {
      collectionBindingSubmitting.value = false
    }
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
    collectionBindingOpen,
    collectionBindingLoading,
    collectionBindingSubmitting,
    collectionBindingArticleTitle,
    collectionBindingValue,
    collectionBindingOptions,
    handleOpenCollectionBinding,
    handleCloseCollectionBinding,
    handleSaveCollectionBinding,
  }
}

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useFeedback } from '@/composables/useFeedback'
import { getArticleList, getCollectionDetail, getCollectionList } from '@/services/api/article'
import type { ArticleItem, CollectionItem } from '@/types/article'

function parsePositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  return undefined
}

export function useCollectionPage() {
  const feedback = useFeedback()
  const route = useRoute()
  const router = useRouter()

  const collection = ref<CollectionItem | null>(null)
  const otherCollections = ref<CollectionItem[]>([])
  const list = ref<ArticleItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(10)
  const collectionLoading = ref(false)
  const listLoading = ref(false)
  const notFound = ref(false)

  const collectionId = computed(() => parsePositiveNumber(route.params.collectionId))
  const loading = computed(() => collectionLoading.value || listLoading.value)

  function getPageFromRoute(): number {
    return parsePositiveNumber(route.query.page) ?? 1
  }

  async function fetchCollectionMeta(id: number): Promise<void> {
    collectionLoading.value = true
    try {
      const [detailResponse, listResponse] = await Promise.all([
        getCollectionDetail(id),
        getCollectionList({ page: 1, page_size: 100 }),
      ])
      collection.value = detailResponse.data
      otherCollections.value = listResponse.data.results.filter((item) => item.id !== id).slice(0, 8)
      notFound.value = false
    } catch (error) {
      collection.value = null
      otherCollections.value = []
      notFound.value = true
      feedback.error(error, '加载合集信息失败')
    } finally {
      collectionLoading.value = false
    }
  }

  async function fetchArticleList(id: number, currentPage = 1): Promise<void> {
    listLoading.value = true
    try {
      const response = await getArticleList({
        page: currentPage,
        page_size: pageSize.value,
        collection: id,
      })
      list.value = response.data.results
      total.value = response.data.count
      page.value = response.data.page
      pageSize.value = response.data.page_size
    } catch (error) {
      list.value = []
      total.value = 0
      page.value = currentPage
      feedback.error(error, '加载合集文章失败')
    } finally {
      listLoading.value = false
    }
  }

  async function refreshPageData(): Promise<void> {
    const id = collectionId.value
    if (!id) {
      notFound.value = true
      collection.value = null
      otherCollections.value = []
      list.value = []
      total.value = 0
      return
    }
    const currentPage = getPageFromRoute()
    await Promise.all([fetchCollectionMeta(id), fetchArticleList(id, currentPage)])
  }

  function buildCollectionRoute(targetPage = 1) {
    const id = collectionId.value
    if (!id) {
      return { name: 'home' as const }
    }
    return {
      name: 'collection' as const,
      params: { collectionId: id },
      query: targetPage > 1 ? { page: String(targetPage) } : {},
    }
  }

  function handlePageChange(targetPage: number): void {
    void router.push(buildCollectionRoute(targetPage))
  }

  watch(
    () => route.fullPath,
    () => {
      void refreshPageData()
    },
    { immediate: true },
  )

  return {
    collection,
    otherCollections,
    list,
    total,
    page,
    pageSize,
    loading,
    notFound,
    handlePageChange,
  }
}

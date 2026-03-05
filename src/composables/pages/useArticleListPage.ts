import { computed, onMounted, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'

import { useFeedback } from '@/composables/useFeedback'
import { useArticleStore } from '@/stores/modules/article'
import type { ArticleItem, CategoryItem } from '@/types/article'

interface UseArticleListPageResult {
  list: Ref<ArticleItem[]>
  total: Ref<number>
  page: Ref<number>
  pageSize: Ref<number>
  loading: Ref<boolean>
  categories: Ref<CategoryItem[]>
  routeName: ComputedRef<string>
  isCategoryRoute: ComputedRef<boolean>
  isQueryRoute: ComputedRef<boolean>
  query: Ref<string>
  selectedCategory: Ref<number | undefined>
  fetchList: (currentPage?: number) => Promise<void>
  applyFiltersToRouteAndFetch: (currentPage?: number) => Promise<void>
  handlePageChange: (currentPage: number) => void
  handlePageSizeChange: (_: number, size: number) => void
}

type NumberLikeInput = string | number | null | undefined | string[] | Array<string | null>

export function useArticleListPage(): UseArticleListPageResult {
  const articleStore = useArticleStore()
  const feedback = useFeedback()
  const route = useRoute()
  const router = useRouter()
  const { list, total, page, pageSize, categories, loading } = storeToRefs(articleStore)

  const query = ref('')
  const selectedCategory = ref<number | undefined>(undefined)
  const routeName = computed(() => String(route.name || ''))
  const isCategoryRoute = computed(() => routeName.value === 'category')
  const isQueryRoute = computed(() => routeName.value === 'query')
  const DEFAULT_PARENT_CATEGORY_NAME = '后端数据库'

  function parsePositiveNumber(value: NumberLikeInput): number | undefined {
    if (Array.isArray(value)) {
      return parsePositiveNumber(value[0])
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (!Number.isNaN(parsed) && parsed > 0) return parsed
    }
    return undefined
  }

  function getPageFromRoute(): number {
    return parsePositiveNumber(route.query.page) ?? 1
  }

  function findCategoryById(id: number): CategoryItem | undefined {
    const stack = [...categories.value]
    while (stack.length) {
      const node = stack.pop()
      if (!node) continue
      if (node.id === id) return node
      if (node.children?.length) {
        stack.push(...node.children)
      }
    }
    return undefined
  }

  function getDefaultCategoryId(): number {
    const topCategories = categories.value.filter((item) => item.level === 1)
    const preferred = topCategories.find((item) => item.name === DEFAULT_PARENT_CATEGORY_NAME)
    return preferred?.id ?? topCategories[0]?.id ?? 1
  }

  async function fetchList(currentPage = 1): Promise<void> {
    try {
      await articleStore.fetchArticleList({
        page: currentPage,
        page_size: pageSize.value,
        q: query.value || undefined,
        category: selectedCategory.value,
      })
    } catch (error) {
      feedback.error(error)
    }
  }

  function handlePageChange(currentPage: number): void {
    void router.push(buildPageRoute(currentPage))
  }

  function handlePageSizeChange(_: number, size: number): void {
    pageSize.value = size
    void router.push(buildPageRoute(1))
  }

  function syncFilterFromRoute(): void {
    const q = route.query.q
    query.value = typeof q === 'string' ? q : ''

    if (isCategoryRoute.value) {
      selectedCategory.value = parsePositiveNumber(route.params.categoryId)
    } else {
      selectedCategory.value = parsePositiveNumber(route.query.category)
    }
  }

  function buildPageRoute(currentPage = 1): RouteLocationRaw {
    const q = query.value.trim()
    const category = selectedCategory.value
    const safePage = currentPage > 1 ? String(currentPage) : undefined

    if (isCategoryRoute.value) {
      const categoryId = category ?? parsePositiveNumber(route.params.categoryId) ?? 1
      return {
        name: 'category',
        params: { categoryId },
        query: (safePage ? { page: safePage } : {}),
      }
    }

    if (isQueryRoute.value) {
      return {
        name: 'query',
        query: {
          ...(q ? { q } : {}),
          ...(safePage ? { page: safePage } : {}),
        },
      }
    }

    return {
      name: 'article-list',
      query: {
        ...(q ? { q } : {}),
        ...(category ? { category: String(category) } : {}),
        ...(safePage ? { page: safePage } : {}),
      },
    }
  }

  async function applyFiltersToRouteAndFetch(currentPage = 1): Promise<void> {
    const q = query.value.trim()
    const category = selectedCategory.value

    if (category && !q) {
      await router.push({
        name: 'category',
        params: { categoryId: category },
        query: (currentPage > 1 ? { page: String(currentPage) } : {}),
      })
      return
    }

    if (q) {
      await router.push({
        name: 'query',
        query: {
          q,
          ...(currentPage > 1 ? { page: String(currentPage) } : {}),
        },
      })
      return
    }

    await router.push(buildPageRoute(currentPage))
  }

  onMounted(async () => {
    try {
      await articleStore.fetchCategories()
    } catch (error) {
      feedback.error(error)
    }
    syncFilterFromRoute()
    if (isCategoryRoute.value && !selectedCategory.value) {
      await router.replace({
        name: 'category',
        params: { categoryId: getDefaultCategoryId() },
      })
      return
    }
    if (isCategoryRoute.value && selectedCategory.value && !findCategoryById(selectedCategory.value)) {
      await router.replace({
        name: 'category',
        params: { categoryId: getDefaultCategoryId() },
      })
      return
    }
    if (isQueryRoute.value && !query.value.trim()) {
      await router.replace({ name: 'home' })
      return
    }
    await fetchList(getPageFromRoute())
  })

  watch(
    () => route.fullPath,
    () => {
      syncFilterFromRoute()
      if (isCategoryRoute.value && !selectedCategory.value) {
        void router.replace({
          name: 'category',
          params: { categoryId: getDefaultCategoryId() },
        })
        return
      }
      if (isCategoryRoute.value && selectedCategory.value && !findCategoryById(selectedCategory.value)) {
        void router.replace({
          name: 'category',
          params: { categoryId: getDefaultCategoryId() },
        })
        return
      }
      if (isQueryRoute.value && !query.value.trim()) {
        void router.replace({ name: 'home' })
        return
      }
      void fetchList(getPageFromRoute())
    },
  )

  return {
    list,
    total,
    page,
    pageSize,
    loading,
    categories,
    routeName,
    isCategoryRoute,
    isQueryRoute,
    query,
    selectedCategory,
    fetchList,
    applyFiltersToRouteAndFetch,
    handlePageChange,
    handlePageSizeChange,
  }
}

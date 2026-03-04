import { defineStore } from 'pinia'
import { ref } from 'vue'

import { getArticleDetail, getArticleList, getCategoryTree, getHomeSummary, type ArticleListQuery } from '@/services/article'
import type { ArticleDetail, ArticleItem, CategoryItem, HomeSummary } from '@/types/article'

export const useArticleStore = defineStore('article', () => {
  const loading = ref(false)
  const homeSummary = ref<HomeSummary | null>(null)
  const list = ref<ArticleItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(10)
  const categories = ref<CategoryItem[]>([])
  const detail = ref<ArticleDetail | null>(null)

  async function fetchHomeSummary() {
    loading.value = true
    try {
      const res = await getHomeSummary()
      homeSummary.value = res.data
    } finally {
      loading.value = false
    }
  }

  async function fetchCategories() {
    const res = await getCategoryTree()
    categories.value = res.data
  }

  async function fetchArticleList(params: ArticleListQuery = {}) {
    loading.value = true
    try {
      const res = await getArticleList(params)
      list.value = res.data.results
      total.value = res.data.count
      page.value = res.data.page
      pageSize.value = res.data.page_size
    } finally {
      loading.value = false
    }
  }

  async function fetchArticleDetail(id: number) {
    loading.value = true
    try {
      const res = await getArticleDetail(id)
      detail.value = res.data
    } finally {
      loading.value = false
    }
  }

  function clearArticleDetail() {
    detail.value = null
  }

  return {
    loading,
    homeSummary,
    list,
    total,
    page,
    pageSize,
    categories,
    detail,
    fetchHomeSummary,
    fetchCategories,
    fetchArticleList,
    fetchArticleDetail,
    clearArticleDetail,
  }
})

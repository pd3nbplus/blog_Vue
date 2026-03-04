import { defineStore } from 'pinia'
import { ref } from 'vue'

import {
  archiveAdminArticle,
  createAdminArticle,
  getAdminArticleDetail,
  getAdminArticleList,
  type AdminArticleListQuery,
  updateAdminArticle,
} from '@/services/api/adminArticle'
import type { AdminArticlePayload, ArticleDetail, ArticleItem } from '@/types/article'

export const useAdminArticleStore = defineStore('adminArticle', () => {
  const loading = ref(false)
  const submitting = ref(false)
  const list = ref<ArticleItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)

  async function fetchList(params: AdminArticleListQuery = {}): Promise<void> {
    loading.value = true
    try {
      const data = await getAdminArticleList(params)
      list.value = data.results
      total.value = data.count
      page.value = data.page
      pageSize.value = data.page_size
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: number): Promise<ArticleDetail> {
    return getAdminArticleDetail(id)
  }

  async function createArticle(payload: AdminArticlePayload): Promise<ArticleDetail> {
    submitting.value = true
    try {
      return await createAdminArticle(payload)
    } finally {
      submitting.value = false
    }
  }

  async function updateArticle(id: number, payload: Partial<AdminArticlePayload>): Promise<ArticleDetail> {
    submitting.value = true
    try {
      return await updateAdminArticle(id, payload)
    } finally {
      submitting.value = false
    }
  }

  async function archiveArticle(id: number): Promise<void> {
    submitting.value = true
    try {
      await archiveAdminArticle(id)
    } finally {
      submitting.value = false
    }
  }

  return {
    loading,
    submitting,
    list,
    total,
    page,
    pageSize,
    fetchList,
    fetchDetail,
    createArticle,
    updateArticle,
    archiveArticle,
  }
})

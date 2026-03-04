import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'

import { useFeedback } from '@/composables/useFeedback'
import { useArticleStore } from '@/stores/modules/article'

export function useArticleDetailPage() {
  const route = useRoute()
  const articleStore = useArticleStore()
  const feedback = useFeedback()
  const { detail, loading } = storeToRefs(articleStore)

  const articleId = computed(() => Number(route.params.id))

  async function loadArticleDetail(id: number) {
    if (!Number.isNaN(id) && id > 0) {
      try {
        await articleStore.fetchArticleDetail(id)
      } catch (error) {
        feedback.error(error)
      }
      return
    }
    articleStore.clearArticleDetail()
  }

  watch(
    articleId,
    (id) => {
      void loadArticleDetail(id)
    },
    { immediate: true },
  )

  return {
    detail,
    loading,
  }
}

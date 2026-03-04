import { computed, watch } from 'vue'
import type { Ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'

import { useFeedback } from '@/composables/useFeedback'
import { useArticleStore } from '@/stores/modules/article'
import type { ArticleDetail } from '@/types/article'

interface UseArticleDetailPageResult {
  detail: Ref<ArticleDetail | null>
  loading: Ref<boolean>
}

export function useArticleDetailPage(): UseArticleDetailPageResult {
  const route = useRoute()
  const articleStore = useArticleStore()
  const feedback = useFeedback()
  const { detail, loading } = storeToRefs(articleStore)

  const articleId = computed(() => Number(route.params.id))

  async function loadArticleDetail(id: number): Promise<void> {
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

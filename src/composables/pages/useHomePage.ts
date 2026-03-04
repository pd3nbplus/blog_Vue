import { onMounted } from 'vue'
import type { Ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useFeedback } from '@/composables/useFeedback'
import { useArticleStore } from '@/stores/modules/article'
import type { HomeSummary } from '@/types/article'

interface UseHomePageResult {
  homeSummary: Ref<HomeSummary | null>
  loading: Ref<boolean>
}

export function useHomePage(): UseHomePageResult {
  const articleStore = useArticleStore()
  const feedback = useFeedback()
  const { homeSummary, loading } = storeToRefs(articleStore)

  onMounted(async () => {
    try {
      await articleStore.fetchHomeSummary()
    } catch (error) {
      feedback.error(error)
    }
  })

  return {
    homeSummary,
    loading,
  }
}

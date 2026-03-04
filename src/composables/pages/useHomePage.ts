import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'

import { useFeedback } from '@/composables/useFeedback'
import { useArticleStore } from '@/stores/modules/article'

export function useHomePage() {
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

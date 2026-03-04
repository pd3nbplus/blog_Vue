import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useFeedback } from '@/composables/useFeedback'
import { useUserStore } from '@/stores/modules/user'

interface UseLoginPageOptions {
  defaultRedirect?: string
}

export function useLoginPage(options: UseLoginPageOptions = {}) {
  const router = useRouter()
  const route = useRoute()
  const userStore = useUserStore()
  const feedback = useFeedback()

  const submitting = ref(false)
  const formState = reactive({
    username: '',
    password: '',
  })

  async function handleSubmit() {
    if (submitting.value) return

    submitting.value = true
    try {
      await userStore.doLogin(formState)
      feedback.success('登录成功')
      const redirect = (route.query.redirect as string) || options.defaultRedirect || '/'
      await router.push(redirect)
    } catch (error) {
      feedback.error(error)
    } finally {
      submitting.value = false
    }
  }

  return {
    formState,
    submitting,
    handleSubmit,
  }
}

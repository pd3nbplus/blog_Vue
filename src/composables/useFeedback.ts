import { message } from 'ant-design-vue'

import { getApiErrorMessage } from '@/services/http'

interface UseFeedbackResult {
  success: (content: string) => void
  error: (err: unknown, fallback?: string) => void
}

export function useFeedback(): UseFeedbackResult {
  function success(content: string): void {
    message.success(content)
  }

  function error(err: unknown, fallback = '请求失败'): void {
    const parsed = getApiErrorMessage(err)
    message.error(parsed || fallback)
  }

  return {
    success,
    error,
  }
}

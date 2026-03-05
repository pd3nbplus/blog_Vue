import { message } from 'ant-design-vue'

import { getApiErrorMessage } from '@/services/http'

interface UseFeedbackResult {
  success: (content: string) => void
  error: <TError>(err: TError, fallback?: string) => void
}

export function useFeedback(): UseFeedbackResult {
  function success(content: string): void {
    message.success(content)
  }

  function error<TError>(err: TError, fallback = '请求失败'): void {
    const parsed = getApiErrorMessage(err)
    message.error(parsed || fallback)
  }

  return {
    success,
    error,
  }
}

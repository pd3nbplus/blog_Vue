import { message } from 'ant-design-vue'

import { getApiErrorMessage } from '@/services/http'

export function useFeedback() {
  function success(content: string) {
    message.success(content)
  }

  function error(err: unknown, fallback = '请求失败') {
    const parsed = getApiErrorMessage(err)
    message.error(parsed || fallback)
  }

  return {
    success,
    error,
  }
}

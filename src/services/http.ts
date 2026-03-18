import axios from 'axios'
import type { AxiosError, AxiosResponse } from 'axios'
import { message } from 'ant-design-vue'

import { API_BASE_URL } from '@/config/env'
import { tokenStorage } from '@/utils/storage'
import type { ApiResponse } from '@/types/api'

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 50000,
})

export const UPLOAD_TIMEOUT_MS = 0

interface ApiErrorLike {
  message?: string
  response?: {
    data?: { message?: string } | string
  }
  isAxiosError?: boolean
}

export type ApiErrorInput = AxiosError<ApiResponse> | ApiErrorLike | Error | string | null | undefined

function isApiErrorLike(value: object): value is ApiErrorLike {
  return 'message' in value || 'response' in value || 'isAxiosError' in value
}

export function getApiErrorMessage<TError>(error: TError): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (axios.isAxiosError<ApiResponse>(error)) {
    const responseMessage = error.response?.data?.message
    if (responseMessage) return responseMessage
    return error.message || ''
  }
  if (error instanceof Error) {
    return error.message || ''
  }
  if (typeof error === 'object' && error && isApiErrorLike(error)) {
    if (typeof error.response?.data === 'string') {
      return error.response.data
    }
    if (error.response?.data?.message) {
      return error.response.data.message
    }
    return error.message || ''
  }
  return ''
}

export async function requestData<T>(requestPromise: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> {
  const response = await requestPromise
  return response.data.data
}

http.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers.Authorization = `Token ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse>) => {
    const status = error.response?.status
    if (status === 401) {
      tokenStorage.remove()
      message.error('登录已失效，请重新登录')
    } else if (status === 403) {
      message.error('无权限访问该资源')
    } else if (status && status >= 500) {
      message.error('服务端异常，请稍后再试')
    }
    return Promise.reject(error)
  },
)

export default http

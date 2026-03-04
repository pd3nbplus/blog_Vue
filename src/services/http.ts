import axios from 'axios'
import type { AxiosError, AxiosResponse } from 'axios'
import { message } from 'ant-design-vue'

import { API_BASE_URL } from '@/config/env'
import { tokenStorage } from '@/utils/storage'
import type { ApiResponse } from '@/types/api'

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

export function getApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<ApiResponse> | undefined
  const responseMessage = axiosError?.response?.data?.message
  if (responseMessage) return responseMessage
  if (axiosError?.message) return axiosError.message
  return ''
}

export async function requestData<T>(requestPromise: Promise<AxiosResponse<ApiResponse<T>>>) {
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

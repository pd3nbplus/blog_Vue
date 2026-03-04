import request from '@/services/http'
import type { ApiResponse } from '@/types/api'
import type { LoginResult, UserProfile } from '@/types/user'

export async function login(payload: { username: string; password: string }) {
  const { data } = await request.post<ApiResponse<LoginResult>>('/auth/login/', payload)
  return data
}

export async function logout() {
  const { data } = await request.post<ApiResponse<null>>('/auth/logout/')
  return data
}

export async function getProfile() {
  const { data } = await request.get<ApiResponse<UserProfile>>('/auth/profile/')
  return data
}

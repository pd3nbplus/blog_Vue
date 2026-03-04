import request from '@/services/http'
import type { ApiResponse } from '@/types/api'
import type { LoginResult, UserProfile } from '@/types/user'

export async function login(payload: { username: string; password: string }): Promise<ApiResponse<LoginResult>> {
  const { data } = await request.post<ApiResponse<LoginResult>>('/auth/login/', payload)
  return data
}

export async function logout(): Promise<ApiResponse<null>> {
  const { data } = await request.post<ApiResponse<null>>('/auth/logout/')
  return data
}

export async function getProfile(): Promise<ApiResponse<UserProfile>> {
  const { data } = await request.get<ApiResponse<UserProfile>>('/auth/profile/')
  return data
}

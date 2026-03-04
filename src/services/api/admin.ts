import request, { requestData } from '@/services/http'
import type { PaginatedData } from '@/types/api'
import type { CategoryItem } from '@/types/article'
import type {
  AdminCategoryPayload,
  AdminCommentItem,
  AdminMediaDirectoryTreeResult,
  AdminLogListResult,
  AdminMediaListResult,
} from '@/types/admin'
import type { UserProfile } from '@/types/user'

export async function getAdminCategoryTree(): Promise<CategoryItem[]> {
  return requestData<CategoryItem[]>(request.get('/admin/categories/tree/'))
}

export async function createAdminCategory(payload: AdminCategoryPayload & { iconFile?: File | null }): Promise<CategoryItem> {
  const formData = new FormData()
  formData.append('name', payload.name)
  if (typeof payload.order === 'number') formData.append('order', String(payload.order))
  if (payload.parent !== undefined && payload.parent !== null) formData.append('parent', String(payload.parent))
  if (payload.slug) formData.append('slug', payload.slug)
  if (payload.iconFile) formData.append('icon_file', payload.iconFile, payload.iconFile.name)
  return requestData<CategoryItem>(
    request.post('/admin/categories/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}

export async function updateAdminCategory(
  id: number,
  payload: Partial<AdminCategoryPayload> & { iconFile?: File | null },
): Promise<CategoryItem> {
  const formData = new FormData()
  if (payload.name !== undefined) formData.append('name', payload.name)
  if (payload.order !== undefined) formData.append('order', String(payload.order))
  if (payload.parent !== undefined && payload.parent !== null) formData.append('parent', String(payload.parent))
  if (payload.slug !== undefined) formData.append('slug', payload.slug)
  if (payload.iconFile) formData.append('icon_file', payload.iconFile, payload.iconFile.name)
  return requestData<CategoryItem>(
    request.patch(`/admin/categories/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}

export async function deleteAdminCategory(id: number): Promise<null> {
  return requestData<null>(request.delete(`/admin/categories/${id}/`))
}

export interface AdminCommentQuery {
  page?: number
  page_size?: number
  q?: string
  approved?: boolean
}

export async function getAdminCommentList(params: AdminCommentQuery): Promise<PaginatedData<AdminCommentItem>> {
  return requestData<PaginatedData<AdminCommentItem>>(request.get('/admin/comments/', { params }))
}

export async function approveAdminComment(id: number, approved: boolean): Promise<AdminCommentItem> {
  return requestData<AdminCommentItem>(request.patch(`/admin/comments/${id}/approve/`, { approved }))
}

export async function deleteAdminComment(id: number): Promise<null> {
  return requestData<null>(request.delete(`/admin/comments/${id}/`))
}

export async function getAdminMediaList(path = '', options?: { includeFiles?: boolean }): Promise<AdminMediaListResult> {
  return requestData<AdminMediaListResult>(
    request.get('/admin/media/', {
      params: {
        path,
        include_files: options?.includeFiles ?? true,
      },
    }),
  )
}

export async function getAdminMediaTree(): Promise<AdminMediaDirectoryTreeResult> {
  return requestData<AdminMediaDirectoryTreeResult>(request.get('/admin/media/tree/'))
}

export async function uploadAdminMediaFile(payload: { path?: string; file: File }): Promise<{ name: string; url: string; path: string }> {
  const formData = new FormData()
  formData.append('file', payload.file, payload.file.name)
  formData.append('path', payload.path || '')
  return requestData<{ name: string; url: string; path: string }>(
    request.post('/admin/media/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  )
}

export async function renameAdminMediaFile(payload: {
  path?: string
  old_name: string
  new_name: string
}): Promise<{ name: string; url: string; path: string }> {
  return requestData<{ name: string; url: string; path: string }>(
    request.post('/admin/media/rename/', {
      path: payload.path || '',
      old_name: payload.old_name,
      new_name: payload.new_name,
    }),
  )
}

export async function getAdminProfile(): Promise<UserProfile> {
  return requestData<UserProfile>(request.get('/admin/profile/'))
}

export async function updateAdminProfile(payload: {
  username?: string
  email?: string
  home_avatar_path?: string
  home_hero_path?: string
}): Promise<UserProfile> {
  return requestData<UserProfile>(request.patch('/admin/profile/', payload))
}

export async function updateAdminPassword(payload: { current_password: string; new_password: string }): Promise<null> {
  return requestData<null>(request.post('/admin/profile/password/', payload))
}

export interface AdminLogQuery {
  page?: number
  page_size?: number
  level?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  q?: string
  source?: 'audit' | 'application' | 'django'
}

export async function getAdminLogList(params: AdminLogQuery): Promise<AdminLogListResult> {
  return requestData<AdminLogListResult>(request.get('/admin/logs/', { params }))
}

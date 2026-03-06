import request, { requestData } from '@/services/http'
import type { PaginatedData } from '@/types/api'
import type { AdminDashboardSummary } from '@/types/admin'
import type { AdminArticlePayload, ArticleDetail, ArticleItem, ArticleStatus } from '@/types/article'

export type AdminArticleOrderingField = 'updated_at' | 'created_at' | 'published_at' | 'view_count' | 'title' | 'status'
export type AdminArticleOrderingDirection = 'asc' | 'desc'

export interface AdminArticleListQuery {
  page?: number
  page_size?: number
  q?: string
  status?: ArticleStatus
  category?: number
  ordering?: `${'' | '-'}${AdminArticleOrderingField}`
}

export async function getAdminArticleList(params: AdminArticleListQuery): Promise<PaginatedData<ArticleItem>> {
  return requestData<PaginatedData<ArticleItem>>(request.get('/admin/articles/', { params }))
}

export async function getAdminArticleDetail(id: number): Promise<ArticleDetail> {
  return requestData<ArticleDetail>(request.get(`/admin/articles/${id}/`))
}

export async function createAdminArticle(payload: AdminArticlePayload): Promise<ArticleDetail> {
  return requestData<ArticleDetail>(request.post('/admin/articles/', payload))
}

export async function updateAdminArticle(id: number, payload: Partial<AdminArticlePayload>): Promise<ArticleDetail> {
  return requestData<ArticleDetail>(request.patch(`/admin/articles/${id}/`, payload))
}

export async function archiveAdminArticle(id: number): Promise<null> {
  return requestData<null>(request.delete(`/admin/articles/${id}/`))
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  return requestData<AdminDashboardSummary>(request.get('/admin/dashboard/summary/'))
}

export interface LocalImageUploadMapping {
  ref: string
  file: File
}

export interface ResolveLocalImagesRequest {
  markdown_content: string
  source_markdown_path: string
  mappings: LocalImageUploadMapping[]
}

export interface ResolveLocalImagesResponse {
  markdown_content: string
  source_markdown_path: string
  uploaded: Array<{ ref: string; saved_to: string; saved_url: string }>
  unresolved_refs: string[]
}

export async function resolveAdminArticleLocalImages(payload: ResolveLocalImagesRequest): Promise<ResolveLocalImagesResponse> {
  const formData = new FormData()
  formData.append('markdown_content', payload.markdown_content)
  formData.append('source_markdown_path', payload.source_markdown_path)

  const serializedMappings = payload.mappings.map((mapping, index) => {
    const fileField = `file_${index}`
    formData.append(fileField, mapping.file, mapping.file.name)
    return {
      ref: mapping.ref,
      file_field: fileField,
    }
  })
  formData.append('mappings', JSON.stringify(serializedMappings))

  return requestData<ResolveLocalImagesResponse>(
    request.post('/admin/articles/resolve-local-images/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  )
}

export async function uploadAdminArticleMarkdown(payload: {
  file: File
  title: string
  category?: number | null
}): Promise<{ markdown_content: string; source_markdown_path: string; saved_to: string }> {
  const formData = new FormData()
  formData.append('markdown_file', payload.file, payload.file.name)
  formData.append('title', payload.title)
  if (payload.category !== undefined && payload.category !== null) formData.append('category', String(payload.category))
  return requestData<{ markdown_content: string; source_markdown_path: string; saved_to: string }>(
    request.post('/admin/articles/upload-markdown/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  )
}

export async function uploadAdminArticleCover(payload: {
  file: File
  title: string
  category?: number | null
}): Promise<{ cover_path: string; saved_to: string }> {
  const formData = new FormData()
  formData.append('cover_file', payload.file, payload.file.name)
  formData.append('title', payload.title)
  if (payload.category !== undefined && payload.category !== null) formData.append('category', String(payload.category))
  return requestData<{ cover_path: string; saved_to: string }>(
    request.post('/admin/articles/upload-cover/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  )
}

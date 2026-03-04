import request, { requestData } from '@/services/http'
import type { PaginatedData } from '@/types/api'
import type { AdminCollectionPayload, CollectionDetail, CollectionItem } from '@/types/article'

export interface AdminCollectionListQuery {
  page?: number
  page_size?: number
  q?: string
  is_pinned?: boolean
  ordering?: string
}

export async function getAdminCollectionList(params: AdminCollectionListQuery = {}): Promise<PaginatedData<CollectionItem>> {
  return requestData<PaginatedData<CollectionItem>>(request.get('/admin/collections/', { params }))
}

export async function getAdminCollectionDetail(id: number): Promise<CollectionDetail> {
  return requestData<CollectionDetail>(request.get(`/admin/collections/${id}/`))
}

export async function createAdminCollection(payload: AdminCollectionPayload): Promise<CollectionDetail> {
  return requestData<CollectionDetail>(request.post('/admin/collections/', payload))
}

export async function updateAdminCollection(id: number, payload: Partial<AdminCollectionPayload>): Promise<CollectionDetail> {
  return requestData<CollectionDetail>(request.patch(`/admin/collections/${id}/`, payload))
}

export async function deleteAdminCollection(id: number): Promise<null> {
  return requestData<null>(request.delete(`/admin/collections/${id}/`))
}

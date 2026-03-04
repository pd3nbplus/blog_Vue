import request from '@/services/http'
import type { ApiResponse, PaginatedData } from '@/types/api'
import type { ArticleDetail, ArticleItem, CategoryItem, CollectionItem, HomeSummary, RecommendedArticlePage } from '@/types/article'

export interface ArticleListQuery {
  page?: number
  page_size?: number
  q?: string
  category?: number
  collection?: number
}

export interface HomeRecommendationsQuery {
  page?: number
  page_size?: number
  seed?: number
  category?: number
}

export async function getHomeSummary(): Promise<ApiResponse<HomeSummary>> {
  const { data } = await request.get<ApiResponse<HomeSummary>>('/home/summary/')
  return data
}

export async function getHomeRecommendations(params: HomeRecommendationsQuery = {}): Promise<ApiResponse<RecommendedArticlePage>> {
  const { data } = await request.get<ApiResponse<RecommendedArticlePage>>('/home/recommendations/', { params })
  return data
}

export async function getArticleList(params: ArticleListQuery): Promise<ApiResponse<PaginatedData<ArticleItem>>> {
  const { data } = await request.get<ApiResponse<PaginatedData<ArticleItem>>>('/articles/', { params })
  return data
}

export async function getArticleDetail(id: number): Promise<ApiResponse<ArticleDetail>> {
  const { data } = await request.get<ApiResponse<ArticleDetail>>(`/articles/${id}/`)
  return data
}

export async function getCategoryTree(): Promise<ApiResponse<CategoryItem[]>> {
  const { data } = await request.get<ApiResponse<CategoryItem[]>>('/categories/tree/')
  return data
}

export interface CollectionListQuery {
  page?: number
  page_size?: number
  q?: string
}

export async function getCollectionList(params: CollectionListQuery = {}): Promise<ApiResponse<PaginatedData<CollectionItem>>> {
  const { data } = await request.get<ApiResponse<PaginatedData<CollectionItem>>>('/collections/', { params })
  return data
}

export async function getCollectionDetail(id: number): Promise<ApiResponse<CollectionItem>> {
  const { data } = await request.get<ApiResponse<CollectionItem>>(`/collections/${id}/`)
  return data
}

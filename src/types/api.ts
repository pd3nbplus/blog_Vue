export interface ApiResponse<T = Record<string, never>> {
  code: number
  message: string
  data: T
}

export interface PaginatedData<T> {
  count: number
  page: number
  page_size: number
  num_pages: number
  results: T[]
}

export interface ApiResponse<T = unknown> {
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

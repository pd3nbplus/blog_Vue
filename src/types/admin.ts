export interface AdminDashboardSummary {
  user_count: number
  article_count: number
  category_count: number
  total_views: number
  category_articles: Record<string, number>
}

export interface AdminCategoryPayload {
  name: string
  parent?: number | null
  order?: number
  slug?: string
}

export interface AdminCommentItem {
  id: number
  article: {
    id: number
    title: string
    slug: string
  }
  author_name: string
  author_email: string
  content: string
  is_approved: boolean
  created_at: string
  updated_at: string
}

export interface AdminMediaFileItem {
  name: string
  url: string
  size: number
  updated_at: string
  is_image: boolean
}

export interface AdminMediaListResult {
  current_path: string
  directories: string[]
  files: AdminMediaFileItem[]
}

export interface AdminMediaDirectoryTreeResult {
  root: string
  directories: string[]
}

export type AdminLogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
export type AdminLogSource = 'audit' | 'application' | 'django'

export interface AdminLogItem {
  id: string
  level: AdminLogLevel
  timestamp: string
  location: string
  message: string
  source: AdminLogSource
  file: string
}

export interface AdminLogListResult {
  count: number
  page: number
  page_size: number
  num_pages: number
  level_counts: Record<AdminLogLevel, number>
  results: AdminLogItem[]
}

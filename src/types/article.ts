export interface UserBrief {
  id: number
  username: string
}

export type ArticleStatus = 'draft' | 'published' | 'archived'

export interface CategoryItem {
  id: number
  name: string
  slug: string
  level: number
  icon_path: string
  order?: number
  parent?: number | null
  children?: CategoryItem[]
}

export interface ArticleItem {
  id: number
  title: string
  slug: string
  summary: string
  cover_path: string
  author: UserBrief
  category: CategoryItem | null
  status: ArticleStatus
  view_count: number
  read_minutes: number
  is_pinned?: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface ArticleDetail extends ArticleItem {
  markdown_content: string
  rendered_html: string
  toc: string
  source_markdown_path: string
  is_pinned?: boolean
}

export interface AdminArticlePayload {
  title: string
  slug: string
  summary: string
  markdown_content: string
  source_markdown_path: string
  cover_path: string
  category: number | null
  status: ArticleStatus
  is_pinned: boolean
}

export interface CollectionItem {
  id: number
  name: string
  slug: string
  summary: string
  cover_path: string
  is_pinned: boolean
  order: number
  article_count: number
  total_views: number
  created_at: string
  updated_at: string
}

export interface CollectionDetail extends CollectionItem {
  article_ids: number[]
}

export interface AdminCollectionPayload {
  name: string
  slug: string
  summary: string
  cover_path: string
  is_pinned: boolean
  order: number
  article_ids: number[]
}

export interface HomeSummary {
  stats: {
    article_count: number
    category_count: number
    collection_count?: number
  }
  latest_articles: ArticleItem[]
  popular_articles: ArticleItem[]
  pinned_collections: CollectionItem[]
  categories: CategoryItem[]
}

export interface RecommendedArticlePage {
  count: number
  page: number
  page_size: number
  num_pages: number
  has_more: boolean
  seed: number
  results: ArticleItem[]
}

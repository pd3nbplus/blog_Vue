import type { ArticleStatus } from '@/types/article'

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}

export const ARTICLE_STATUS_OPTIONS: Array<{ label: string; value: ArticleStatus }> = [
  { label: ARTICLE_STATUS_LABELS.draft, value: 'draft' },
  { label: ARTICLE_STATUS_LABELS.published, value: 'published' },
  { label: ARTICLE_STATUS_LABELS.archived, value: 'archived' },
]

export function isArticleStatus(value: string | null | undefined): value is ArticleStatus {
  return value === 'draft' || value === 'published' || value === 'archived'
}

export function getArticleStatusLabel(status?: string | null): string {
  if (!status) return '-'
  if (isArticleStatus(status)) {
    return ARTICLE_STATUS_LABELS[status]
  }
  return status
}

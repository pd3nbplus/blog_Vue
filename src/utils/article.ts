import type { CategoryItem } from '@/types/article'

export interface CategoryOption {
  label: string
  value: number
}

export function flattenCategoryTreeToOptions(
  categories: CategoryItem[],
  depth = 0,
  result: CategoryOption[] = [],
): CategoryOption[] {
  for (const category of categories) {
    const prefix = depth > 0 ? `${'  '.repeat(depth)}- ` : ''
    result.push({ label: `${prefix}${category.name}`, value: category.id })
    if (category.children?.length) {
      flattenCategoryTreeToOptions(category.children, depth + 1, result)
    }
  }
  return result
}

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import ArticlePreviewCard from '@/components/common/ArticlePreviewCard.vue'
import CategoryTreePanel from '@/components/common/CategoryTreePanel.vue'
import { useArticleListPage } from '@/composables/pages/useArticleListPage'
import { getHomeRecommendations } from '@/services/api/article'
import type { ArticleItem, CategoryItem } from '@/types/article'
import { resolveTempAsset } from '@/utils/assets'

const { list, total, page, pageSize, loading, categories, query, selectedCategory, isCategoryRoute, isQueryRoute, handlePageChange } =
  useArticleListPage()
const router = useRouter()

const spotlightArticle = ref<ArticleItem | null>(null)
const spotlightLoading = ref(false)
const spotlightRefreshing = ref(false)
const spotlightCountdownCycle = ref(0)
const spotlightSwitchDelayMs = 320
const spotlightRefreshDurationMs = 900
let spotlightTimer: number | undefined

const totalPages = computed(() => {
  if (!pageSize.value) return 1
  return Math.max(1, Math.ceil(total.value / pageSize.value))
})

const pageNumbers = computed(() => {
  const pages: number[] = []
  for (let num = 1; num <= totalPages.value; num += 1) {
    if (num > page.value - 3 && num < page.value + 3) pages.push(num)
  }
  return pages
})

const currentCategory = computed(() => {
  if (!selectedCategory.value) return null
  return findCategoryById(categories.value, selectedCategory.value)
})

const currentGroupCategory = computed(() => {
  const current = currentCategory.value
  if (!current) return null
  if (current.level === 1) return current
  const parentFromTree = findParentCategoryByChildId(categories.value, current.id)
  if (parentFromTree) return parentFromTree
  if (current.parent) return findCategoryById(categories.value, current.parent) || current
  return current
})

function findCategoryById(tree: CategoryItem[], id: number): CategoryItem | null {
  for (const node of tree) {
    if (node.id === id) return node
    if (node.children?.length) {
      const found = findCategoryById(node.children, id)
      if (found) return found
    }
  }
  return null
}

function findParentCategoryByChildId(tree: CategoryItem[], childId: number): CategoryItem | null {
  for (const node of tree) {
    if (node.children?.some((child) => child.id === childId)) {
      return node
    }
    if (node.children?.length) {
      const found = findParentCategoryByChildId(node.children, childId)
      if (found) return found
    }
  }
  return null
}

function isActiveCategory(id: number): boolean {
  return selectedCategory.value === id
}

function goToCategory(categoryId: number): void {
  if (selectedCategory.value === categoryId) return
  void router.push({ name: 'category', params: { categoryId } })
}

function articleCover(path?: string | null): string {
  return resolveTempAsset(path) || '/img/hero-image.jpg'
}

function categoryIcon(path?: string | null): string {
  return resolveTempAsset(path)
}

function articleCategoryIcon(path?: string | null): string {
  return resolveTempAsset(path)
}

function formatDateTime(input?: string | null): string {
  if (!input) return ''
  return input.slice(0, 19).replace('T', ' ')
}

function truncateSpotlightSummary(summary?: string | null): string {
  const text = (summary || '').trim()
  if (!text) return ''
  const chars = Array.from(text)
  if (chars.length <= 40) return text
  return `${chars.slice(0, 40).join('')}...`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function resetSpotlightCountdown(): void {
  spotlightCountdownCycle.value += 1
}

async function refreshSpotlightArticle(options: { withAnimation?: boolean } = {}): Promise<void> {
  if (!isCategoryRoute.value && !isQueryRoute.value) {
    spotlightArticle.value = null
    return
  }
  if (isCategoryRoute.value && !selectedCategory.value) {
    spotlightArticle.value = null
    return
  }
  if (spotlightLoading.value) return

  const withAnimation = options.withAnimation ?? true
  const shouldAnimate = withAnimation && Boolean(spotlightArticle.value)

  spotlightLoading.value = true
  resetSpotlightCountdown()
  if (shouldAnimate) {
    spotlightRefreshing.value = true
  }
  try {
    const response = await getHomeRecommendations({
      page: 1,
      page_size: 1,
      category: isCategoryRoute.value ? selectedCategory.value : undefined,
    })
    const nextArticle = response.data.results[0] || null
    if (shouldAnimate) {
      await sleep(spotlightSwitchDelayMs)
    }
    spotlightArticle.value = nextArticle
  } catch {
    if (!spotlightArticle.value) {
      spotlightArticle.value = null
    }
  } finally {
    spotlightLoading.value = false
    if (shouldAnimate) {
      window.setTimeout(() => {
        spotlightRefreshing.value = false
      }, Math.max(0, spotlightRefreshDurationMs - spotlightSwitchDelayMs))
    } else {
      spotlightRefreshing.value = false
    }
  }
}

function startSpotlightTimer(): void {
  if (spotlightTimer) {
    window.clearInterval(spotlightTimer)
  }
  spotlightTimer = window.setInterval(() => {
    void refreshSpotlightArticle()
  }, 10000)
}

function handleManualSpotlightRefresh(): void {
  void refreshSpotlightArticle()
  if (isCategoryRoute.value && selectedCategory.value) {
    startSpotlightTimer()
  }
}

watch(
  [isCategoryRoute, isQueryRoute, selectedCategory, query],
  ([categoryRoute, queryRoute, categoryId]) => {
    if ((!categoryRoute && !queryRoute) || (categoryRoute && !categoryId)) {
      spotlightArticle.value = null
      spotlightRefreshing.value = false
      if (spotlightTimer) {
        window.clearInterval(spotlightTimer)
        spotlightTimer = undefined
      }
      return
    }
    void refreshSpotlightArticle({ withAnimation: false })
    startSpotlightTimer()
  },
  { immediate: true },
)

onUnmounted(() => {
  if (spotlightTimer) {
    window.clearInterval(spotlightTimer)
  }
})
</script>

<template>
  <a-spin :spinning="loading">
    <div class="main-content">
      <div class="column left-column">
        <div class="spotlight-panel">
          <template v-if="isCategoryRoute || isQueryRoute">
            <article class="spotlight-card card app-surface-card">
              <div class="card-header spotlight-card-header">
                <h3>随机推荐文章</h3>
                <button class="spotlight-refresh-btn" type="button" :disabled="spotlightLoading" @click.prevent="handleManualSpotlightRefresh">
                  {{ spotlightLoading ? '刷新中...' : '随机刷新一篇' }}
                </button>
              </div>
              <div class="spotlight-countdown">
                <span :key="`spotlight-countdown-${spotlightCountdownCycle}`"></span>
              </div>
              <div class="card-body spotlight-card-body">
                <router-link
                  v-if="spotlightArticle"
                  :to="{ name: 'article-detail', params: { id: spotlightArticle.id } }"
                  class="spotlight-link"
                >
                  <div class="spotlight-content" :class="{ 'is-refreshing': spotlightRefreshing }">
                    <h4 class="spotlight-title">{{ spotlightArticle.title }}</h4>
                    <p class="spotlight-summary">{{ truncateSpotlightSummary(spotlightArticle.summary) || '暂无摘要' }}</p>
                    <div class="spotlight-meta">
                      <span>发布于 {{ formatDateTime(spotlightArticle.published_at || spotlightArticle.created_at) }}</span>
                      <span>🔥 {{ spotlightArticle.view_count }} 热度</span>
                      <span>⏱ {{ spotlightArticle.read_minutes }} 分钟</span>
                    </div>
                    <div class="spotlight-meta">
                      <span>作者 {{ spotlightArticle.author.username }}</span>
                      <span>{{ spotlightArticle.category?.name || '未分类' }}</span>
                    </div>
                  </div>
                </router-link>
                <div v-else class="spotlight-content spotlight-empty" :class="{ 'is-refreshing': spotlightRefreshing }">
                  <p v-if="spotlightLoading">正在加载推荐文章...</p>
                  <p v-else>当前分类暂无可推荐文章</p>
                </div>
              </div>
            </article>
          </template>
          <img v-else src="/img/query-img.jpg" alt="search" />
        </div>

        <CategoryTreePanel :categories="categories" @select="goToCategory" />
      </div>

      <div class="column right-column">
        <template v-if="isQueryRoute">
          <div class="query-content">
            <h2>#<span class="query-str">{{ query }}</span></h2>
          </div>
        </template>

        <template v-else-if="isCategoryRoute && currentGroupCategory">
          <div class="query-content">
            <div class="level-1-category">
              <p class="category-row">
                <span
                  class="category-nav-tag"
                  :class="{ active: isActiveCategory(currentGroupCategory.id) }"
                  role="button"
                  tabindex="0"
                  @click="goToCategory(currentGroupCategory.id)"
                  @keydown.enter.prevent="goToCategory(currentGroupCategory.id)"
                  @keydown.space.prevent="goToCategory(currentGroupCategory.id)"
                >
                  <img
                    v-if="categoryIcon(currentGroupCategory.icon_path)"
                    :src="categoryIcon(currentGroupCategory.icon_path)"
                    alt="icon"
                    class="category-icon"
                  />
                  {{ currentGroupCategory.name }}
                </span>
              </p>
            </div>
            <div v-if="currentGroupCategory.children?.length" class="level-2-category">
              <p class="category-row">
                <span
                  v-for="subcategory in currentGroupCategory.children || []"
                  :key="subcategory.id"
                  class="category-nav-tag"
                  :class="{ active: isActiveCategory(subcategory.id) }"
                  role="button"
                  tabindex="0"
                  @click="goToCategory(subcategory.id)"
                  @keydown.enter.prevent="goToCategory(subcategory.id)"
                  @keydown.space.prevent="goToCategory(subcategory.id)"
                >
                  <img
                    v-if="categoryIcon(subcategory.icon_path)"
                    :src="categoryIcon(subcategory.icon_path)"
                    alt="icon"
                    class="category-child-icon"
                  />
                  {{ subcategory.name }}
                </span>
              </p>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="query-content">
            <h2>#<span class="query-str">全部文章</span></h2>
          </div>
        </template>

        <div class="main-articles">
          <ul v-if="list.length">
            <li v-for="article in list" :key="article.id">
              <ArticlePreviewCard
                :article-id="article.id"
                :cover-src="articleCover(article.cover_path)"
                :title="article.title"
                :date-text="formatDateTime(article.created_at)"
                :view-count="article.view_count"
                :read-minutes="article.read_minutes"
                :summary="article.summary || ''"
                :max-summary-length="80"
                :tag-name="article.category?.name || '未分类'"
                :tag-icon-src="articleCategoryIcon(article.category?.icon_path)"
              />
            </li>
          </ul>
          <h2 v-else class="text-center">没有找到相关文章...</h2>
        </div>

        <div class="d-flex justify-content-center">
          <nav aria-label="Page navigation">
            <ul class="pagination">
              <li v-if="page > 1" class="page-item">
                <a class="page-link" href="javascript:void(0);" @click.prevent="handlePageChange(1)">首页</a>
              </li>
              <li v-if="page > 1" class="page-item">
                <a class="page-link" href="javascript:void(0);" @click.prevent="handlePageChange(page - 1)">上一页</a>
              </li>

              <li v-for="num in pageNumbers" :key="num" class="page-item" :class="{ active: num === page }">
                <a v-if="num !== page" class="page-link" href="javascript:void(0);" @click.prevent="handlePageChange(num)">{{ num }}</a>
                <span v-else class="page-link">{{ num }}</span>
              </li>

              <li v-if="page < totalPages" class="page-item">
                <a class="page-link" href="javascript:void(0);" @click.prevent="handlePageChange(page + 1)">下一页</a>
              </li>
              <li v-if="page < totalPages" class="page-item">
                <a class="page-link" href="javascript:void(0);" @click.prevent="handlePageChange(totalPages)">末页</a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  </a-spin>
</template>

<style>
@import '@/styles/pages/article-list-page-content.css';
</style>

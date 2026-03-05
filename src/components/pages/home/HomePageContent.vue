<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import AppImage from '@/components/common/AppImage.vue'
import ArticlePreviewCard from '@/components/common/ArticlePreviewCard.vue'
import CategoryTreePanel from '@/components/common/CategoryTreePanel.vue'
import { useFeedback } from '@/composables/useFeedback'
import { useHomePage } from '@/composables/pages/useHomePage'
import { useArticleStore } from '@/stores/modules/article'
import { getArticleList, getHomeRecommendations } from '@/services/api/article'
import type { ArticleItem, CategoryItem, CollectionItem } from '@/types/article'
import { resolveTempAsset } from '@/utils/assets'

const { homeSummary, loading } = useHomePage()
const articleStore = useArticleStore()
const { categories } = storeToRefs(articleStore)
const router = useRouter()
const feedback = useFeedback()
const isLiked = ref(false)
const recommendedArticles = ref<ArticleItem[]>([])
const recommendationPage = ref(1)
const recommendationSeed = ref<number | undefined>(undefined)
const recommendationHasMore = ref(true)
const recommendationLoading = ref(false)
const recommendationInitialized = ref(false)
const latestUpdates = ref<ArticleItem[]>([])
const latestUpdatesLoaded = ref(false)
const latestArticlesCount = 10
const latestUpdatesCount = 5
const latestUpdatesPageSize = 100
const recommendationInitialPageSize = 12
const recommendationScrollPageSize = 8
const recommendationScrollThreshold = 180
const backTopVisibleThreshold = 420
const paperLatestCount = 5
const paperLatestPageSize = 100
const paperLatestMaxScanPages = 30
let nonCriticalLoadTimer: number | null = null
let nonCriticalIdleId: number | null = null
const mobileHeroRatio = ref(16 / 9)
const paperLatestArticles = ref<ArticleItem[]>([])
const paperLatestLoaded = ref(false)
const showMobileBackTop = ref(false)

const latestArticles = computed(() =>
  [...(homeSummary.value?.latest_articles || [])]
    .sort((a, b) => {
      const aTimestamp = a.created_at ? Date.parse(a.created_at) : Number.NEGATIVE_INFINITY
      const bTimestamp = b.created_at ? Date.parse(b.created_at) : Number.NEGATIVE_INFINITY
      return bTimestamp - aTimestamp
    })
    .slice(0, latestArticlesCount),
)
const pinnedCollections = computed<CollectionItem[]>(() => (homeSummary.value?.pinned_collections || []).slice(0, 3))
const siteProfile = computed(() => homeSummary.value?.site_profile)
const homeDisplayName = computed(() => siteProfile.value?.display_name || 'pdnbplus')
const homeAvatarSrc = computed(() => resolveTempAsset(siteProfile.value?.home_avatar_path) || '/img/profile-image.png')
const homeHeroSrc = computed(() => resolveTempAsset(siteProfile.value?.home_hero_path) || '/img/hero-image.webp')
const homeShellStyle = computed(() => ({
  '--mobile-hero-ratio': String(mobileHeroRatio.value || 16 / 9),
}))
const paperLatestDisplayArticles = computed(() => {
  if (paperLatestLoaded.value && paperLatestArticles.value.length) {
    return paperLatestArticles.value
  }
  return latestArticles.value.slice(0, paperLatestCount)
})

function toggleLike(): void {
  isLiked.value = !isLiked.value
}

function getCoverSrc(path?: string | null): string {
  const resolved = resolveTempAsset(path)
  return resolved || '/img/background.jpg'
}

function getCategoryIcon(path?: string | null): string {
  return resolveTempAsset(path)
}

function formatDate(input?: string | null): string {
  if (!input) return ''
  return input.slice(0, 10).replace(/-/g, '/')
}

function formatDateTime(input?: string | null): string {
  if (!input) return ''
  return input.slice(0, 19).replace('T', ' ')
}

function updateActivityLabel(article: ArticleItem): '新发布' | '新更新' {
  const createdAt = article.created_at ? Date.parse(article.created_at) : NaN
  const publishedAt = article.published_at ? Date.parse(article.published_at) : NaN
  if (!Number.isFinite(createdAt) || !Number.isFinite(publishedAt)) {
    return '新更新'
  }
  return createdAt === publishedAt ? '新发布' : '新更新'
}

function formatCount(value?: number | null): string {
  const num = Number(value || 0)
  return num.toLocaleString('zh-CN')
}

function articleCategory(article: ArticleItem): string {
  return article.category?.name || '未分类'
}

function articleCategoryIcon(article: ArticleItem): string {
  return getCategoryIcon(article.category?.icon_path)
}

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

function goToCategory(categoryId: number): void {
  const category = findCategoryById(categories.value, categoryId)
  if (!category) return
  void router.push({ name: 'category', params: { categoryId: category.id } })
}

function handleHeroImageLoad(event: Event): void {
  const img = event.target as HTMLImageElement | null
  if (!img) return
  if (!img.naturalWidth || !img.naturalHeight) return
  const ratio = img.naturalWidth / img.naturalHeight
  if (!Number.isFinite(ratio) || ratio <= 0) return
  mobileHeroRatio.value = ratio
}

async function loadCategories(): Promise<void> {
  if (categories.value.length) return
  try {
    await articleStore.fetchCategories()
  } catch (error) {
    feedback.error(error, '加载分类失败')
  }
}

function isNearBottom(): boolean {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const pageHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0
  return scrollTop + viewportHeight >= pageHeight - recommendationScrollThreshold
}

function getScrollTop(): number {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
}

function updateBackTopVisible(): void {
  showMobileBackTop.value = getScrollTop() >= backTopVisibleThreshold
}

async function loadRecommendations(reset = false): Promise<void> {
  const shouldReset = reset || !recommendationInitialized.value
  if (recommendationLoading.value) return
  if (!shouldReset && !recommendationHasMore.value) return

  recommendationLoading.value = true
  try {
    const targetPage = shouldReset ? 1 : recommendationPage.value
    const pageSize = shouldReset ? recommendationInitialPageSize : recommendationScrollPageSize
    const res = await getHomeRecommendations({
      page: targetPage,
      page_size: pageSize,
      seed: recommendationSeed.value,
    })
    const pageData = res.data
    recommendationSeed.value = pageData.seed
    recommendationHasMore.value = pageData.has_more

    if (shouldReset) {
      recommendedArticles.value = pageData.results
    } else {
      const exists = new Set(recommendedArticles.value.map((item) => item.id))
      for (const item of pageData.results) {
        if (exists.has(item.id)) continue
        exists.add(item.id)
        recommendedArticles.value.push(item)
      }
    }
    recommendationPage.value = pageData.page + 1
    recommendationInitialized.value = true
  } catch (error) {
    feedback.error(error, '加载推荐文章失败')
  } finally {
    recommendationLoading.value = false
  }
}

function byPublishedAtDesc(a: ArticleItem, b: ArticleItem): number {
  const aTimestamp = a.published_at ? Date.parse(a.published_at) : Number.NEGATIVE_INFINITY
  const bTimestamp = b.published_at ? Date.parse(b.published_at) : Number.NEGATIVE_INFINITY
  return bTimestamp - aTimestamp
}

function byCreatedAtDesc(a: ArticleItem, b: ArticleItem): number {
  const aTimestamp = a.created_at
    ? Date.parse(a.created_at)
    : (a.published_at ? Date.parse(a.published_at) : Number.NEGATIVE_INFINITY)
  const bTimestamp = b.created_at
    ? Date.parse(b.created_at)
    : (b.published_at ? Date.parse(b.published_at) : Number.NEGATIVE_INFINITY)
  return bTimestamp - aTimestamp
}

async function loadLatestUpdates(): Promise<void> {
  if (latestUpdatesLoaded.value) return
  const pinnedArticles: ArticleItem[] = []
  const nonPinnedArticles: ArticleItem[] = []
  let page = 1
  let numPages = 1

  try {
    while (page <= numPages) {
      const response = await getArticleList({
        page,
        page_size: latestUpdatesPageSize,
      })
      const pageData = response.data
      numPages = pageData.num_pages || 1

      for (const article of pageData.results) {
        if (article.is_pinned) {
          pinnedArticles.push(article)
          continue
        }
        if (nonPinnedArticles.length < latestUpdatesCount) {
          nonPinnedArticles.push(article)
        }
      }

      if (nonPinnedArticles.length >= latestUpdatesCount) {
        break
      }
      page += 1
    }

    latestUpdates.value = [...pinnedArticles, ...nonPinnedArticles].sort(byPublishedAtDesc).slice(0, latestUpdatesCount)
    latestUpdatesLoaded.value = true
  } catch (error) {
    latestUpdates.value = []
    feedback.error(error, '加载最新动态失败')
  }
}

function normalizeText(value?: string | null): string {
  return String(value || '').trim().toLowerCase()
}

function matchesPaperCategory(category: CategoryItem): boolean {
  const name = normalizeText(category.name)
  const slug = normalizeText(category.slug)
  if (name.includes('论文')) return true
  if (name.includes('paper')) return true
  if (slug.includes('paper')) return true
  if (slug.includes('lunwen')) return true
  return false
}

function findPaperCategoryId(tree: CategoryItem[]): number | null {
  const queue: CategoryItem[] = [...tree]
  const matchedTopLevel: CategoryItem[] = []
  const matchedAny: CategoryItem[] = []

  while (queue.length) {
    const node = queue.shift()
    if (!node) continue
    if (matchesPaperCategory(node)) {
      matchedAny.push(node)
      if (node.level === 1) matchedTopLevel.push(node)
    }
    if (node.children?.length) {
      queue.push(...node.children)
    }
  }

  if (matchedTopLevel.length) return matchedTopLevel[0]?.id ?? null
  return matchedAny[0]?.id ?? null
}

async function loadPaperLatestArticles(): Promise<void> {
  if (paperLatestLoaded.value) return
  try {
    const categoryId = findPaperCategoryId(categories.value)
    if (!categoryId) {
      paperLatestArticles.value = latestArticles.value.slice(0, paperLatestCount)
      paperLatestLoaded.value = true
      return
    }

    const collected: ArticleItem[] = []
    const seen = new Set<number>()
    let page = 1
    let numPages = 1

    while (page <= numPages && page <= paperLatestMaxScanPages) {
      const response = await getArticleList({
        category: categoryId,
        page,
        page_size: paperLatestPageSize,
      })
      const pageData = response.data
      numPages = Math.max(1, pageData.num_pages || 1)

      for (const article of pageData.results || []) {
        if (seen.has(article.id)) continue
        seen.add(article.id)
        collected.push(article)
      }
      page += 1
    }

    paperLatestArticles.value = collected.sort(byCreatedAtDesc).slice(0, paperLatestCount)
    paperLatestLoaded.value = true
  } catch (error) {
    paperLatestArticles.value = latestArticles.value.slice(0, paperLatestCount)
    paperLatestLoaded.value = true
    feedback.error(error, '加载论文类最新文章失败')
  }
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

function queueNonCriticalLoads(): void {
  const triggerLoads = (): void => {
    void loadLatestUpdates()
    void loadRecommendations(true)
  }

  const win = window as IdleWindow
  if (typeof win.requestIdleCallback === 'function') {
    nonCriticalIdleId = win.requestIdleCallback(triggerLoads, { timeout: 1500 })
    return
  }

  nonCriticalLoadTimer = window.setTimeout(() => {
    triggerLoads()
  }, 700)
}

function handleScroll(): void {
  updateBackTopVisible()
  if (!isNearBottom()) return
  void loadRecommendations(false)
}

function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  void loadCategories().then(() => {
    void loadPaperLatestArticles()
  })
  queueNonCriticalLoads()
  updateBackTopVisible()
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  if (nonCriticalLoadTimer) {
    window.clearTimeout(nonCriticalLoadTimer)
    nonCriticalLoadTimer = null
  }
  const win = window as IdleWindow
  if (nonCriticalIdleId !== null && typeof win.cancelIdleCallback === 'function') {
    win.cancelIdleCallback(nonCriticalIdleId)
    nonCriticalIdleId = null
  }
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <a-spin :spinning="loading">
    <div class="home-page-shell" :style="homeShellStyle">
      <div class="hero">
        <div class="cover-layer">
          <div class="motto-content">
            <h2>想,&nbsp; 都是问题</h2>
            <h2>&nbsp;</h2>
            <h1>做,&nbsp; 才有答案</h1>
            <h2>&nbsp;</h2>
            <h2>站着不动，永远是观众！</h2>
          </div>
        </div>
        <AppImage
          :src="homeHeroSrc"
          alt="Hero Image"
          class="hero-image"
          fallback-src="/img/hero-image.jpg"
          loading="eager"
          fetchpriority="high"
          decoding="async"
          @load="handleHeroImageLoad"
        />
      </div>

      <div class="main-content home-main-content">
        <div class="column left-column">
          <div class="personal-intro">
            <div class="profile-image">
              <AppImage :src="homeAvatarSrc" alt="Profile Image" fallback-src="/img/profile-image.png" />
            </div>
            <h2>{{ homeDisplayName }}</h2>
            <div class="stats">
              <div>
                <span>文章</span>
                <span>{{ homeSummary?.stats.article_count ?? 0 }}</span>
              </div>
              <div>
                <span>分类</span>
                <span>{{ homeSummary?.stats.category_count ?? 0 }}</span>
              </div>
            </div>
            <button class="like-btn" :class="{ liked: isLiked }" @click="toggleLike">
              点个赞 <span class="heart-icon">♥</span>
            </button>
          </div>

          <div class="latest-articles">
            <h2>Newest Paper Reading Article</h2>
            <ul>
              <li v-for="article in paperLatestDisplayArticles" :key="article.id">
                <ArticlePreviewCard
                  :article-id="article.id"
                  :cover-src="getCoverSrc(article.cover_path)"
                  :title="article.title"
                  :footer-info="`${articleCategory(article)} | ${formatDate(article.created_at)} | ${article.read_minutes} 分钟`"
                />
              </li>
            </ul>
          </div>
        </div>

        <div class="column middle-column">
          <div v-if="pinnedCollections.length" class="pinned-collections app-surface-card">
            <div class="pinned-collections-header">
              <h2>置顶合集</h2>
              <span class="collection-section-pill">精选专题</span>
            </div>
            <ul>
              <li v-for="collection in pinnedCollections" :key="collection.id">
                <router-link :to="{ name: 'collection', params: { collectionId: collection.id } }" class="collection-card collection-link">
                  <AppImage
                    :src="getCoverSrc(collection.cover_path)"
                    :alt="collection.name"
                    class="collection-cover"
                    fallback-src="/img/background.jpg"
                  />
                  <div class="collection-main">
                    <p class="collection-badge">Collection</p>
                    <h3>{{ collection.name }}</h3>
                    <p class="collection-summary">{{ collection.summary || '暂无合集概述' }}</p>
                    <div class="collection-stats">
                      <span>文章 {{ formatCount(collection.article_count) }}</span>
                      <span>浏览 {{ formatCount(collection.total_views) }}</span>
                    </div>
                    <span class="collection-entry">进入合集 →</span>
                  </div>
                </router-link>
              </li>
            </ul>
          </div>

          <div class="popular-articles">
            <h2>随机推荐文章</h2>
            <ul>
              <li v-for="article in recommendedArticles" :key="article.id">
                <ArticlePreviewCard
                  :article-id="article.id"
                  :cover-src="getCoverSrc(article.cover_path)"
                  :title="article.title"
                  :date-text="formatDateTime(article.created_at)"
                  :view-count="article.view_count"
                  :read-minutes="article.read_minutes"
                  :summary="article.summary || '暂无摘要'"
                  :max-summary-length="80"
                  :tag-name="articleCategory(article)"
                  :tag-icon-src="articleCategoryIcon(article)"
                />
              </li>
            </ul>
            <p v-if="recommendationLoading" class="recommendation-tip">正在加载推荐...</p>
            <p v-else-if="!recommendationHasMore" class="recommendation-tip">没有更多推荐了</p>
          </div>
        </div>

        <div class="column right-column">
          <div class="latest-updates">
            <h2>最新动态</h2>
            <ul>
              <li v-for="update in latestUpdates" :key="update.id">
                <span class="update-type" :class="{ 'update-type--edited': updateActivityLabel(update) === '新更新' }">
                  {{ updateActivityLabel(update) }}
                </span>
                <router-link :to="{ name: 'article-detail', params: { id: update.id } }" class="update-title">
                  {{ update.title }}
                </router-link>
              </li>
            </ul>
          </div>

          <CategoryTreePanel :categories="categories" @select="goToCategory" />
        </div>
      </div>

      <button
        v-if="showMobileBackTop"
        type="button"
        class="mobile-back-top"
        aria-label="回到顶部"
        @click="scrollToTop"
      >
        顶部
      </button>
    </div>
  </a-spin>
</template>

<style>
@import '@/styles/legacy/home.css';

.home-main-content {
  width: min(100% - clamp(1.25rem, 7vw, 6.5rem), 1720px);
  margin: 20px auto;
}

.recommendation-tip {
  color: #666;
  text-align: center;
  margin: 12px 0 6px;
}

.pinned-collections {
  margin-bottom: 12px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--primary) 34%, var(--border));
  padding: 12px;
  background:
    radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 56%),
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 52%),
    linear-gradient(135deg, color-mix(in srgb, var(--surface) 88%, var(--surface-2)), var(--surface)),
    var(--surface);
  box-shadow: var(--shadow-soft);
}

.pinned-collections-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.pinned-collections h2 {
  margin: 0;
}

.collection-section-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--primary) 30%, var(--border));
  background: color-mix(in srgb, var(--primary) 14%, var(--surface));
  color: var(--primary);
  font-family: var(--font-main);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.1;
  padding: 4px 10px;
  letter-spacing: 0.02em;
}

.pinned-collections ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.collection-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--primary) 22%, var(--border));
  padding: 10px;
  background: color-mix(in srgb, var(--surface) 86%, var(--surface-2));
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.collection-link {
  text-decoration: none;
  color: inherit;
}

.collection-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--primary) 46%, var(--border));
  box-shadow: var(--tile-hover-shadow);
}

.collection-cover {
  width: 74px;
  height: 56px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.collection-main {
  min-width: 0;
}

.collection-main h3 {
  margin: 6px 0 0;
  font-size: 0.98rem;
  line-height: 1.35;
}

.collection-badge {
  margin: 0;
  display: inline-flex;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--primary) 28%, var(--border));
  background: color-mix(in srgb, var(--primary) 12%, var(--surface));
  color: var(--primary);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 2px 7px;
}

.collection-summary {
  margin: 4px 0;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.45;
}

.collection-stats {
  display: flex;
  gap: 8px;
  color: var(--muted);
  font-size: 0.78rem;
}

.collection-entry {
  margin-top: 4px;
  display: inline-flex;
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 700;
}

.update-type {
  display: inline-flex;
  align-items: center;
  margin-right: 8px;
  border-radius: 999px;
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--primary) 24%, var(--border));
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 10%, var(--surface));
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
}

.update-type--edited {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
  color: color-mix(in srgb, var(--accent) 78%, #0d6f66);
  background: color-mix(in srgb, var(--accent) 14%, var(--surface));
}

.mobile-back-top {
  display: none;
}

@media screen and (max-width: 768px) {
  .home-page-shell {
    position: relative;
    --mobile-hero-height: clamp(10.5rem, calc(100vw / var(--mobile-hero-ratio)), 19rem);
    --mobile-intro-top: 33vh;
  }

  @supports (height: 100dvh) {
    .home-page-shell {
      --mobile-intro-top: 33dvh;
    }
  }

  .home-page-shell .hero {
    display: block !important;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: var(--mobile-hero-height);
    z-index: 0;
    pointer-events: none;
  }

  .home-page-shell .cover-layer {
    display: none;
  }

  .home-page-shell .hero-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .home-page-shell .main-content {
    position: relative;
    z-index: 1;
    margin-top: var(--mobile-intro-top);
  }

  .home-page-shell .right-column,
  .home-page-shell .pinned-collections {
    display: none;
  }

  .home-page-shell .left-column .personal-intro {
    margin-top: 0;
  }

  .home-main-content {
    width: min(100% - clamp(0.75rem, 4.2vw, 1.25rem), 100%);
    margin: 0 auto 16px;
  }

  .mobile-back-top {
    position: fixed;
    right: 14px;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
    z-index: 6;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    height: 44px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--primary) 28%, var(--border));
    background: color-mix(in srgb, var(--surface) 90%, var(--primary) 10%);
    color: var(--primary);
    font-family: var(--font-main);
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1;
    box-shadow: var(--shadow-soft);
    cursor: pointer;
  }
}
</style>

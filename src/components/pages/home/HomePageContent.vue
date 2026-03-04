<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import AppImage from '@/components/common/AppImage.vue'
import ArticlePreviewCard from '@/components/common/ArticlePreviewCard.vue'
import { useFeedback } from '@/composables/useFeedback'
import { useHomePage } from '@/composables/pages/useHomePage'
import { getHomeRecommendations } from '@/services/article'
import type { ArticleItem, CategoryItem, CollectionItem } from '@/types/article'
import { resolveTempAsset } from '@/utils/assets'

const { homeSummary, loading } = useHomePage()
const feedback = useFeedback()
const openedCategories = ref<number[]>([])
const isLiked = ref(false)
const recommendedArticles = ref<ArticleItem[]>([])
const recommendationPage = ref(1)
const recommendationSeed = ref<number | undefined>(undefined)
const recommendationHasMore = ref(true)
const recommendationLoading = ref(false)
const latestArticlesCount = 10
const recommendationInitialPageSize = 12
const recommendationScrollPageSize = 8
const recommendationScrollThreshold = 180

const latestArticles = computed(() => (homeSummary.value?.latest_articles || []).slice(0, latestArticlesCount))
const pinnedCollections = computed<CollectionItem[]>(() => (homeSummary.value?.pinned_collections || []).slice(0, 3))
const latestUpdates = computed(() => (homeSummary.value?.latest_articles || []).slice(0, 5))
const siteProfile = computed(() => homeSummary.value?.site_profile)
const homeDisplayName = computed(() => siteProfile.value?.display_name || 'pdnbplus')
const homeAvatarSrc = computed(() => resolveTempAsset(siteProfile.value?.home_avatar_path) || '/img/profile-image.png')
const homeHeroSrc = computed(() => resolveTempAsset(siteProfile.value?.home_hero_path) || '/img/hero-image.jpg')

function isOpened(id: number): boolean {
  return openedCategories.value.includes(id)
}

function toggleCategory(id: number): void {
  if (isOpened(id)) {
    openedCategories.value = openedCategories.value.filter((item) => item !== id)
    return
  }
  openedCategories.value.push(id)
}

function toggleLike() {
  isLiked.value = !isLiked.value
}

function getCoverSrc(path?: string | null): string {
  const resolved = resolveTempAsset(path)
  return resolved || '/img/hero-image.jpg'
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
  const updatedAt = article.updated_at ? Date.parse(article.updated_at) : NaN
  const updateThresholdMs = 60 * 1000
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) {
    return '新发布'
  }
  return updatedAt - createdAt > updateThresholdMs ? '新更新' : '新发布'
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

function topCategories(categories: CategoryItem[] = []): CategoryItem[] {
  return categories.filter((item) => item.level === 1)
}

function isNearBottom(): boolean {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const pageHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0
  return scrollTop + viewportHeight >= pageHeight - recommendationScrollThreshold
}

async function loadRecommendations(reset = false): Promise<void> {
  if (recommendationLoading.value) return
  if (!reset && !recommendationHasMore.value) return

  recommendationLoading.value = true
  try {
    const targetPage = reset ? 1 : recommendationPage.value
    const pageSize = reset ? recommendationInitialPageSize : recommendationScrollPageSize
    const res = await getHomeRecommendations({
      page: targetPage,
      page_size: pageSize,
      seed: recommendationSeed.value,
    })
    const pageData = res.data
    recommendationSeed.value = pageData.seed
    recommendationHasMore.value = pageData.has_more

    if (reset) {
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
  } catch (error) {
    feedback.error(error, '加载推荐文章失败')
  } finally {
    recommendationLoading.value = false
  }
}

function handleScroll(): void {
  if (!isNearBottom()) return
  void loadRecommendations(false)
}

onMounted(() => {
  void loadRecommendations(true)
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <a-spin :spinning="loading">
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
      <AppImage :src="homeHeroSrc" alt="Hero Image" class="hero-image" fallback-src="/img/hero-image.jpg" />
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
            <li v-for="article in latestArticles" :key="article.id">
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
                  fallback-src="/img/hero-image.jpg"
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

        <div class="categories">
          <div class="categories-title">
            <h2>文章分类</h2>
          </div>
          <ul>
            <li v-for="category in topCategories(homeSummary?.categories || [])" :key="category.id" class="category-item">
              <a href="javascript:void(0);" @click.prevent="toggleCategory(category.id)">
                <span class="arrowhead-span">></span> {{ category.name }}
              </a>
              <ul v-show="isOpened(category.id)" class="subcategory-list">
                <li v-for="subcategory in category.children || []" :key="subcategory.id">
                  <router-link :to="{ name: 'category', params: { categoryId: subcategory.id } }">
                    &nbsp;&nbsp;&nbsp;&nbsp;<span class="arrowhead-span">></span>
                    {{ subcategory.name }}
                  </router-link>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
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

@media screen and (max-width: 768px) {
  .home-main-content {
    width: min(100% - clamp(0.75rem, 4.2vw, 1.25rem), 100%);
  }
}
</style>

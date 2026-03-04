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

    <div class="main-content">
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
              {{ update.author.username }} 发布了
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

<style scoped>
.hero {
  position: relative;
  width: min(100%, 1800px);
  height: clamp(300px, 70vh, 760px);
  margin: 0 auto;
  overflow: hidden;
}

.hero-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(
      112deg,
      color-mix(in srgb, var(--surface) 92%, transparent) 0%,
      color-mix(in srgb, var(--surface-2) 86%, transparent) 48%,
      transparent 72%
    );
  display: flex;
  align-items: center;
  transform-origin: left bottom;
  animation: reveal 1.8s forwards;
  pointer-events: none;
}

.motto-content {
  margin-left: clamp(1rem, 8vw, 11%);
  color: var(--text);
  opacity: 0;
  animation: floatIn 2.8s forwards;
}

.motto-content h1,
.motto-content h2 {
  margin: 0;
  line-height: 1.08;
  text-shadow: 0 5px 18px rgb(0 0 0 / 8%);
}

.motto-content h1 {
  font-size: clamp(2rem, 5.5vw, 4.2rem);
  font-weight: 800;
}

.motto-content h2 {
  font-size: clamp(1.3rem, 3.7vw, 3rem);
  font-weight: 600;
}

@keyframes reveal {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(56%);
  }
}

@keyframes floatIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.main-content {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: clamp(0.8rem, 1.5vw, 1.2rem);
  max-width: min(96vw, 1560px);
  margin: 20px auto;
}

.left-column {
  flex: 0 0 clamp(255px, 22vw, 360px);
}

.middle-column {
  flex: 1 1 auto;
  min-width: 0;
}

.right-column {
  flex: 0 0 clamp(230px, 21vw, 330px);
}

.personal-intro,
.latest-articles,
.latest-updates,
.categories-title {
  border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
  padding: 12px;
  background: var(--surface);
}

.latest-articles,
.latest-updates {
  margin-top: 12px;
}

.personal-intro {
  text-align: center;
  border: 1px solid color-mix(in srgb, var(--primary) 26%, var(--border));
  background:
    radial-gradient(circle at 10% 8%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 45%),
    radial-gradient(circle at 90% 8%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 42%),
    linear-gradient(145deg, color-mix(in srgb, var(--surface-2) 76%, var(--surface)), var(--surface));
}

.profile-image {
  width: clamp(4.5rem, 8vw, 6.2rem);
  height: clamp(4.5rem, 8vw, 6.2rem);
  margin: 0 auto 10px;
}

.profile-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--primary) 28%, var(--border));
  box-shadow: 0 10px 22px rgb(0 0 0 / 10%);
}

.personal-intro h2 {
  margin: 0;
  color: var(--text);
  font-size: clamp(1.2rem, 2.2vw, 1.5rem);
}

.stats {
  margin: 10px 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.stats div {
  border-radius: 10px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 88%, var(--surface-2));
  padding: 8px 10px;
}

.stats span:first-child {
  display: block;
  color: var(--muted);
  font-size: 0.82rem;
}

.stats span:last-child {
  color: var(--text);
  font-size: 1.15rem;
  font-weight: 700;
}

.like-btn {
  background: var(--btn-success);
  color: var(--btn-text-on-success);
  border: 1px solid color-mix(in srgb, var(--btn-success) 70%, var(--border));
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 9px 16px;
  transition: filter 0.2s ease, transform 0.2s ease;
}

.heart-icon {
  margin-left: 5px;
  font-size: 1.06rem;
  color: #fff !important;
  transition: none;
}

.like-btn:hover {
  filter: brightness(0.95);
  transform: translateY(-1px);
}

.like-btn:hover .heart-icon {
  color: #fff !important;
}

.like-btn.liked .heart-icon,
.like-btn.liked:hover .heart-icon {
  color: #ff0000 !important;
}

.latest-articles h2,
.popular-articles h2,
.latest-updates h2,
.categories-title h2,
.pinned-collections h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text);
}

.latest-articles ul,
.popular-articles ul,
.latest-updates ul,
.pinned-collections ul,
.categories ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.latest-articles ul {
  margin-top: 8px;
}

.latest-articles li {
  padding: 14px 10px;
  border-bottom: 1px solid var(--border);
  border-radius: 8px;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.latest-articles li:last-child {
  border-bottom: 0;
}

.latest-articles li:hover {
  background: var(--surface-2);
  border-color: color-mix(in srgb, var(--primary) 28%, var(--border));
}

.popular-articles {
  margin-top: 12px;
}

.popular-articles li {
  margin-bottom: 10px;
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
}

.popular-articles li:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--primary) 34%, var(--border));
  box-shadow: var(--tile-hover-shadow);
}

.recommendation-tip {
  color: var(--muted);
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
  color: var(--text);
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
  flex-wrap: wrap;
}

.collection-entry {
  margin-top: 4px;
  display: inline-flex;
  color: var(--primary);
  font-size: 0.78rem;
  font-weight: 700;
}

.latest-updates ul {
  margin-top: 10px;
}

.latest-updates li {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 6px 0;
  color: var(--muted);
  border-bottom: 1px dashed color-mix(in srgb, var(--border) 80%, transparent);
}

.latest-updates li:last-child {
  border-bottom: 0;
}

.update-title {
  text-decoration: none;
  color: var(--text);
  font-weight: 600;
}

.update-title:hover {
  color: var(--primary);
}

.categories-title {
  margin-top: 12px;
}

.categories-title h2 {
  font-size: 1.02rem;
}

.categories ul {
  margin-top: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.category-item {
  border-bottom: 1px solid var(--border);
}

.category-item:last-child {
  border-bottom: 0;
}

.arrowhead-span {
  opacity: 0.55;
  width: 0.8rem;
  display: inline-block;
  text-align: center;
  font-size: 0.82em;
  color: var(--muted);
}

.category-item > a {
  text-decoration: none;
  color: var(--text);
  font-size: 1rem;
  font-weight: 650;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.7rem 0.9rem;
  border-left: 3px solid transparent;
  border-radius: 8px;
  transition: color 0.2s, background-color 0.2s, border-color 0.2s;
}

.category-item > a:hover {
  color: var(--primary);
  background: var(--surface-2);
  border-left-color: var(--primary);
}

.subcategory-list {
  margin: 0.2rem 0.55rem 0.5rem 1.15rem;
  padding: 0.35rem 0.45rem 0.35rem 0.75rem;
  background: color-mix(in srgb, var(--surface-2) 80%, var(--surface));
  border-radius: 8px;
  position: relative;
}

.subcategory-list::before {
  content: '';
  position: absolute;
  left: 0.42rem;
  top: 0.35rem;
  bottom: 0.35rem;
  border-left: 2px dashed color-mix(in srgb, var(--muted) 45%, transparent);
  pointer-events: none;
}

.subcategory-list li {
  border-bottom: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
}

.subcategory-list li:last-child {
  border-bottom: 0;
}

.subcategory-list li a {
  text-decoration: none;
  color: var(--muted);
  font-size: 0.92rem;
  font-weight: 500;
  display: block;
  padding: 0.45rem 0.55rem 0.45rem 1.05rem;
  border-radius: 6px;
  transition: color 0.2s, background-color 0.2s;
}

.subcategory-list li a:hover {
  color: var(--text);
  background: var(--surface-2);
}

@media (max-width: 1120px) {
  .main-content {
    flex-wrap: wrap;
  }

  .left-column,
  .right-column {
    flex: 1 1 280px;
  }

  .middle-column {
    flex-basis: 100%;
    order: 3;
  }
}

@media (max-width: 768px) {
  .hero {
    display: none;
  }

  .main-content {
    flex-direction: column;
    margin: 12px auto;
  }

  .left-column,
  .middle-column,
  .right-column {
    width: 100%;
    flex: 1 1 auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cover-layer,
  .motto-content {
    animation: none;
    transform: none;
    opacity: 1;
  }
}
</style>

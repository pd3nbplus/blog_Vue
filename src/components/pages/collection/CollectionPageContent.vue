<script setup lang="ts">

import AppImage from '@/components/common/AppImage.vue'
import ArticlePreviewCard from '@/components/common/ArticlePreviewCard.vue'
import { useCollectionPage } from '@/composables/pages/useCollectionPage'
import type { ArticleItem, CollectionItem } from '@/types/article'
import { resolveTempAsset } from '@/utils/assets'

const { collection, otherCollections, list, total, page, pageSize, loading, notFound, handlePageChange } = useCollectionPage()

function getCoverSrc(path?: string | null): string {
  return resolveTempAsset(path) || '/img/hero-image.jpg'
}

function formatDateTime(input?: string | null): string {
  if (!input) return ''
  return input.slice(0, 19).replace('T', ' ')
}

function formatCount(value?: number | null): string {
  return Number(value || 0).toLocaleString('zh-CN')
}

function articleCategory(article: ArticleItem): string {
  return article.category?.name || '未分类'
}

function articleCategoryIcon(article: ArticleItem): string {
  return resolveTempAsset(article.category?.icon_path)
}

function collectionArticleTotal(item?: CollectionItem | null): string {
  return formatCount(item?.article_count || 0)
}

function showTotal(totalCount: number): string {
  return `共 ${totalCount} 篇`
}
</script>

<template>
  <a-spin :spinning="loading">
    <div class="main-content collection-layout">
      <div class="column left-column">
        <section v-if="collection" class="collection-hero app-surface-card">
          <AppImage :src="getCoverSrc(collection.cover_path)" :alt="collection.name" class="collection-hero-cover" fallback-src="/img/hero-image.jpg" />
          <div class="collection-hero-body">
            <p class="collection-badge">Curated Collection</p>
            <h2>{{ collection.name }}</h2>
            <p class="collection-summary">{{ collection.summary || '暂无合集概述' }}</p>
            <div class="collection-stats">
              <span>文章 {{ collectionArticleTotal(collection) }}</span>
              <span>浏览 {{ formatCount(collection.total_views) }}</span>
            </div>
            <div class="collection-meta">
              <p>创建于 {{ formatDateTime(collection.created_at) }}</p>
              <p>更新于 {{ formatDateTime(collection.updated_at) }}</p>
            </div>
          </div>
        </section>

        <section class="other-collections app-surface-card">
          <div class="other-collections-header">
            <h3>其他合集</h3>
            <span>{{ otherCollections.length }}</span>
          </div>
          <ul v-if="otherCollections.length">
            <li v-for="item in otherCollections" :key="item.id">
              <router-link :to="{ name: 'collection', params: { collectionId: item.id } }" class="other-collection-link">
                <AppImage :src="getCoverSrc(item.cover_path)" :alt="item.name" class="other-collection-cover" fallback-src="/img/hero-image.jpg" />
                <div class="other-collection-main">
                  <h4>{{ item.name }}</h4>
                  <p>{{ item.summary || '暂无概述' }}</p>
                  <span>文章 {{ collectionArticleTotal(item) }}</span>
                </div>
              </router-link>
            </li>
          </ul>
          <p v-else class="other-collections-empty">暂无其他合集</p>
        </section>
      </div>

      <div class="column right-column">
        <template v-if="collection">
          <div class="query-content collection-header">
            <p>合集文章列表</p>
            <h2>#<span class="query-str">{{ collection.name }}</span></h2>
          </div>

          <div class="main-articles">
            <ul v-if="list.length">
              <li v-for="article in list" :key="article.id">
                <ArticlePreviewCard
                  :article-id="article.id"
                  :cover-src="getCoverSrc(article.cover_path)"
                  :title="article.title"
                  :date-text="formatDateTime(article.published_at || article.created_at)"
                  :view-count="article.view_count"
                  :read-minutes="article.read_minutes"
                  :summary="article.summary || ''"
                  :max-summary-length="80"
                  :tag-name="articleCategory(article)"
                  :tag-icon-src="articleCategoryIcon(article)"
                />
              </li>
            </ul>
            <h2 v-else class="text-center">该合集下暂无已发布文章</h2>
          </div>

          <div class="pagination-wrap">
            <a-pagination
              :current="page"
              :page-size="pageSize"
              :total="total"
              :show-size-changer="false"
              :show-total="showTotal"
              @change="handlePageChange"
            />
          </div>
        </template>

        <template v-else-if="notFound">
          <div class="query-content collection-header">
            <h2>#<span class="query-str">合集不存在</span></h2>
            <p>请从左侧其他合集中继续浏览</p>
          </div>
        </template>
      </div>
    </div>
  </a-spin>
</template>

<style scoped>

.collection-layout {
  display: flex;
  align-items: flex-start;
  gap: clamp(0.8rem, 1.4vw, 1.2rem);
  max-width: min(96vw, 1560px);
  margin: 20px auto;
}

.collection-layout .left-column {
  flex: 0 0 clamp(230px, 21vw, 320px);
  min-width: 220px;
}

.collection-layout .right-column {
  flex: 1 1 auto;
  min-width: 0;
}

.collection-layout .query-content {
  border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
  padding: 10px 14px;
  background: var(--surface);
  margin-bottom: 12px;
}

.collection-layout .query-content h2 {
  margin: 0;
  line-height: 1.35;
  font-size: 1.38rem;
}

.collection-layout .query-content .query-str {
  margin-left: 8px;
  color: var(--primary);
  font-size: clamp(1.24rem, 2.2vw, 1.86rem);
  font-weight: 700;
  font-family: var(--font-main);
}

.collection-layout .main-articles ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.collection-layout .main-articles li {
  padding: 16px;
  margin-bottom: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
}

.collection-layout .main-articles li:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
  box-shadow: var(--tile-hover-shadow);
}

.collection-layout .main-articles .text-center {
  text-align: center;
  color: var(--muted);
  padding: 22px 0;
}

.pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.collection-layout .collection-header p {
  margin: 0;
  color: var(--muted);
}

.collection-hero {
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--primary) 25%, var(--border));
  background:
    radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 48%),
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 46%),
    var(--surface);
  box-shadow: var(--shadow-soft);
  margin-bottom: 12px;
}

.collection-hero-cover {
  width: 100%;
  height: clamp(130px, 18vw, 180px);
  object-fit: cover;
  display: block;
}

.collection-hero-body {
  padding: 14px;
}

.collection-badge {
  margin: 0;
  display: inline-flex;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border));
  background: color-mix(in srgb, var(--primary) 15%, var(--surface));
  color: var(--primary);
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.collection-hero-body h2 {
  margin: 10px 0 8px;
  font-size: 1.25rem;
  line-height: 1.35;
}

.collection-summary {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
  font-size: 0.9rem;
}

.collection-stats {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.collection-stats span {
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 2px 8px;
  color: var(--muted);
  font-size: 0.8rem;
}

.collection-meta {
  margin-top: 10px;
  color: var(--muted);
  font-size: 0.8rem;
}

.collection-meta p {
  margin: 0;
}

.other-collections {
  border-radius: 14px;
  padding: 12px;
}

.other-collections-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.other-collections-header h3 {
  margin: 0;
  font-size: 1rem;
}

.other-collections-header span {
  color: var(--muted);
  font-size: 0.8rem;
}

.other-collections ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.other-collection-link {
  display: flex;
  gap: 8px;
  text-decoration: none;
  color: inherit;
  border-radius: 10px;
  border: 1px solid var(--border);
  padding: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.other-collection-link:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
  box-shadow: var(--tile-hover-shadow);
}

.other-collection-cover {
  width: 74px;
  height: 56px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.other-collection-main {
  min-width: 0;
}

.other-collection-main h4 {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.35;
}

.other-collection-main p {
  margin: 4px 0;
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.other-collection-main span {
  color: var(--muted);
  font-size: 0.76rem;
}

.other-collections-empty {
  margin: 6px 0 0;
  color: var(--muted);
}

.collection-header {
  border: 1px solid color-mix(in srgb, var(--primary) 24%, var(--border));
  background:
    linear-gradient(
      130deg,
      color-mix(in srgb, var(--primary) 12%, transparent),
      color-mix(in srgb, var(--accent) 8%, transparent) 46%,
      color-mix(in srgb, var(--primary) 8%, transparent)
    ),
    var(--surface);
}

@media (max-width: 960px) {
  .collection-layout {
    flex-direction: column;
  }

  .left-column {
    min-width: 100%;
    flex: 1 1 auto;
  }
}
</style>

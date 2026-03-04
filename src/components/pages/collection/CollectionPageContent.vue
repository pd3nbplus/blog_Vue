<script setup lang="ts">
import { computed } from 'vue'

import AppImage from '@/components/common/AppImage.vue'
import ArticlePreviewCard from '@/components/common/ArticlePreviewCard.vue'
import { useCollectionPage } from '@/composables/pages/useCollectionPage'
import type { ArticleItem, CollectionItem } from '@/types/article'
import { resolveTempAsset } from '@/utils/assets'

const { collection, otherCollections, list, total, page, pageSize, loading, notFound, handlePageChange } = useCollectionPage()

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

<style>
@import '/css/bootstrap.min.css';
@import '@/styles/legacy/q_and_cbase.css';

.collection-layout {
  align-items: stretch;
}

.collection-hero {
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, #145ca8 25%, var(--border));
  background:
    radial-gradient(circle at 0% 0%, rgb(20 92 168 / 20%), transparent 48%),
    radial-gradient(circle at 100% 0%, rgb(16 185 129 / 20%), transparent 46%),
    var(--surface);
  box-shadow: 0 18px 38px rgb(16 24 40 / 12%);
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
  border: 1px solid color-mix(in srgb, #145ca8 35%, var(--border));
  background: color-mix(in srgb, #145ca8 15%, var(--surface));
  color: #145ca8;
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
  border-color: color-mix(in srgb, #145ca8 28%, var(--border));
  box-shadow: var(--shadow-soft);
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
  border: 1px solid color-mix(in srgb, #145ca8 24%, var(--border));
  background:
    linear-gradient(130deg, rgb(20 92 168 / 10%), rgb(14 165 233 / 8%) 46%, rgb(16 185 129 / 10%)),
    var(--surface);
}

.collection-header p {
  margin: 0;
  color: var(--muted);
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

<script setup lang="ts">
import { computed } from 'vue'

import AppImage from '@/components/common/AppImage.vue'

interface Props {
  articleId: number
  coverSrc: string
  title: string
  dateText?: string
  viewCount?: number | string | null
  readMinutes?: number | string | null
  summary?: string
  summaryFallback?: string
  maxSummaryLength?: number
  footerInfo?: string
  tagName?: string
  tagIconSrc?: string
  coverAlt?: string
}

const props = withDefaults(defineProps<Props>(), {
  dateText: '',
  viewCount: undefined,
  readMinutes: undefined,
  summary: '',
  summaryFallback: '',
  maxSummaryLength: 80,
  footerInfo: '',
  tagName: '',
  tagIconSrc: '',
  coverAlt: '缩略图',
})

const summaryText = computed(() => {
  const raw = props.summary?.trim() || props.summaryFallback?.trim() || ''
  if (!raw) return ''
  const chars = Array.from(raw)
  if (chars.length <= props.maxSummaryLength) return raw
  return `${chars.slice(0, props.maxSummaryLength).join('')}...`
})
</script>

<template>
  <router-link :to="{ name: 'article-detail', params: { id: articleId } }">
    <div class="article">
      <AppImage :src="coverSrc" :alt="coverAlt" class="article-main-img" fallback-src="/img/hero-image.jpg" />
      <div class="article-details">
        <div v-if="dateText || viewCount !== undefined || readMinutes !== undefined" class="article-meta">
          <span v-if="dateText" class="article-date">发布于 {{ dateText }}</span>
          <span v-if="viewCount !== undefined && viewCount !== null" class="article-views">🔥 {{ viewCount }} 热度</span>
          <span v-if="readMinutes !== undefined && readMinutes !== null" class="article-read-minutes">⏱ {{ readMinutes }} 分钟</span>
        </div>
        <h2>{{ title }}</h2>
        <p v-if="footerInfo" class="footer-info">{{ footerInfo }}</p>
        <p v-else-if="summaryText">{{ summaryText }}</p>
        <div v-if="tagName" class="article-tags">
          <span class="tag">
            <AppImage v-if="tagIconSrc" :src="tagIconSrc" alt="分类图标" class="category-icon" :fallback-src="''" hide-on-error />
            {{ tagName }}
          </span>
        </div>
      </div>
    </div>
  </router-link>
</template>

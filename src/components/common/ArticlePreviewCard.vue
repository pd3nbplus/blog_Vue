<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { BACKEND_ORIGIN } from '@/utils/assets'

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

function isRemoteHttpImage(src: string): boolean {
  return /^https?:\/\//i.test((src || '').trim())
}

function isCsdnImageHost(src: string): boolean {
  try {
    const host = new URL(src).hostname.toLowerCase()
    return host === 'csdnimg.cn' || host.endsWith('.csdnimg.cn')
  } catch {
    return false
  }
}

function buildImageProxyUrl(remoteImageUrl: string): string {
  try {
    const url = new URL(remoteImageUrl)
    url.hash = ''
    return `${BACKEND_ORIGIN}/api/v1/image-proxy/?url=${encodeURIComponent(url.toString())}`
  } catch {
    const noHash = remoteImageUrl.split('#', 1)[0] || remoteImageUrl
    return `${BACKEND_ORIGIN}/api/v1/image-proxy/?url=${encodeURIComponent(noHash)}`
  }
}

const normalizedCoverSrc = computed(() => (props.coverSrc || '').trim())
const isRemoteCover = computed(() => isRemoteHttpImage(normalizedCoverSrc.value))
const proxiedCoverSrc = computed(() => {
  if (!isRemoteCover.value || !isCsdnImageHost(normalizedCoverSrc.value)) return normalizedCoverSrc.value
  return buildImageProxyUrl(normalizedCoverSrc.value)
})
const activeCoverSrc = ref(proxiedCoverSrc.value || '/img/hero-image.jpg')

watch(
  proxiedCoverSrc,
  (nextSrc) => {
    activeCoverSrc.value = nextSrc || '/img/hero-image.jpg'
  },
  { immediate: true },
)

function handleCoverError() {
  if (activeCoverSrc.value !== '/img/hero-image.jpg') {
    activeCoverSrc.value = '/img/hero-image.jpg'
  }
}
</script>

<template>
  <router-link :to="{ name: 'article-detail', params: { id: articleId } }">
    <div class="article">
      <img
        :src="activeCoverSrc"
        :alt="coverAlt"
        class="article-main-img"
        :referrerpolicy="isRemoteCover ? 'no-referrer' : undefined"
        loading="lazy"
        @error="handleCoverError"
      />
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
            <img v-if="tagIconSrc" :src="tagIconSrc" alt="分类图标" class="category-icon" />
            {{ tagName }}
          </span>
        </div>
      </div>
    </div>
  </router-link>
</template>

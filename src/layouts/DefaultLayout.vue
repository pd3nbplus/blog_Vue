<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryValue } from 'vue-router'
import { useTheme, type AppTheme } from '@/composables/useTheme'
import { getCollectionList } from '@/services/api/article'
import { useArticleStore } from '@/stores/modules/article'
import type { CollectionItem } from '@/types/article'

const router = useRouter()
const route = useRoute()
const { currentTheme, themeOptions, setTheme } = useTheme()
const articleStore = useArticleStore()
const DEFAULT_PARENT_CATEGORY_NAME = '后端数据库'
const featuredCollectionId = ref<number | undefined>(undefined)

const categoryNavTarget = computed(() => {
  const topCategories = articleStore.categories.filter((item) => item.level === 1)
  const preferred = topCategories.find((item) => item.name === DEFAULT_PARENT_CATEGORY_NAME)
  return {
    name: 'category' as const,
    params: { categoryId: preferred?.id ?? topCategories[0]?.id ?? 1 },
  }
})

const featuredCollectionNavTarget = computed(() => {
  if (featuredCollectionId.value) {
    return {
      name: 'collection' as const,
      params: { collectionId: featuredCollectionId.value },
    }
  }
  return { name: 'article-list' as const }
})

const searchText = ref('')

function normalizeQueryValue(value: LocationQueryValue | LocationQueryValue[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

async function submitSearch(): Promise<void> {
  const q = searchText.value.trim()
  if (!q) return
  await router.push({ name: 'query', query: { q } })
}

function handleThemeChange(event: Event): void {
  const select = event.target as HTMLSelectElement
  setTheme(select.value as AppTheme)
}

async function resolveFeaturedCollection(): Promise<void> {
  try {
    const response = await getCollectionList({ page: 1, page_size: 50 })
    const rows = response.data.results || []
    const pinnedTop = rows.find((item: CollectionItem) => item.is_pinned)
    const target = pinnedTop || rows[0]
    featuredCollectionId.value = target?.id
  } catch {
    featuredCollectionId.value = undefined
  }
}

watch(
  () => route.query.q,
  (value) => {
    searchText.value = normalizeQueryValue(value)
  },
  { immediate: true },
)

if (!articleStore.categories.length) {
  void articleStore.fetchCategories().catch(() => {})
}

onMounted(() => {
  void resolveFeaturedCollection()
})
</script>

<template>
  <div class="legacy-page">
    <div class="navbar">
      <div class="navbar-content">
        <div class="navbar-links">
          <router-link :to="{ name: 'home' }">主页</router-link>
          <router-link :to="categoryNavTarget">文章分类</router-link>
          <router-link :to="featuredCollectionNavTarget">精选合集</router-link>
          <router-link to="/admin/dashboard/">Admin</router-link>
        </div>
        <div class="navbar-search">
          <a-input-search
            v-model:value="searchText"
            class="navbar-search-input"
            placeholder="搜索文章标题、摘要..."
            enter-button="搜索"
            allow-clear
            @search="submitSearch"
          />
        </div>
        <div class="navbar-tools">
          <div class="theme-switcher">
            <label for="global-theme-picker">主题</label>
            <select id="global-theme-picker" :value="currentTheme" @change="handleThemeChange">
              <option v-for="item in themeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div class="content">
      <router-view />
    </div>

    <div class="footer">
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">辽ICP备2022003164号-1</a>
      &nbsp; &copy; 2024 pdnbplus. All rights reserved.
    </div>
  </div>
</template>

<style>
/* non-scoped: layout shell needs global structure styles from legacy base stylesheet */
@import '@/styles/legacy/base.css';
</style>

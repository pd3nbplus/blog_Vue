<script setup lang="ts">
import AppImage from '@/components/common/AppImage.vue'
import type { ArticleItem } from '@/types/article'
import { resolveTempAsset } from '@/utils/assets'

defineProps<{
  list: ArticleItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', id: number): void
  (e: 'archive', id: number): void
}>()

function getCoverSrc(path?: string | null): string {
  if (!path) return '/img/hero-image.jpg'
  return resolveTempAsset(path)
}
</script>

<template>
  <a-table
    class="article-table"
    :data-source="list"
    :loading="loading"
    :pagination="false"
    row-key="id"
    size="middle"
    :scroll="{ x: 1200 }"
  >
    <a-table-column title="序号" data-index="id" />
    <a-table-column title="作者">
      <template #default="{ record }">
        {{ record.author?.username || '-' }}
      </template>
    </a-table-column>
    <a-table-column title="标题" data-index="title" />
    <a-table-column title="缩略图">
      <template #default="{ record }">
        <AppImage :src="getCoverSrc(record.cover_path)" alt="cover" class="thumb" fallback-src="/img/hero-image.jpg" />
      </template>
    </a-table-column>
    <a-table-column title="分类">
      <template #default="{ record }">
        {{ record.category?.name || '未分类' }}
      </template>
    </a-table-column>
    <a-table-column title="状态" data-index="status" />
    <a-table-column title="浏览" data-index="view_count" />
    <a-table-column title="更新时间" data-index="updated_at" />
    <a-table-column title="操作" fixed="right">
      <template #default="{ record }">
        <a-space>
          <a-button size="small" type="primary" ghost @click="emit('edit', record.id)">编辑</a-button>
          <a-popconfirm title="确认归档该文章？" @confirm="emit('archive', record.id)">
            <a-button size="small" danger>归档</a-button>
          </a-popconfirm>
        </a-space>
      </template>
    </a-table-column>
  </a-table>
</template>

<style scoped>
.article-table :deep(.ant-table) {
  border-radius: 10px;
  overflow: hidden;
  background-color: var(--surface);
  color: var(--muted);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
}

.article-table :deep(.ant-table-thead > tr > th) {
  color: var(--text);
  font-weight: 700;
  background: var(--surface);
  border-bottom: 2px solid var(--border);
}

.article-table :deep(.ant-table-tbody > tr > td),
.article-table :deep(.ant-table-thead > tr > th) {
  padding: 15px;
  font-size: 16px;
  vertical-align: middle;
}

.article-table :deep(.ant-table-tbody > tr:hover > td) {
  background-color: color-mix(in srgb, var(--surface-2) 85%, transparent) !important;
  color: var(--text);
}

.thumb {
  width: clamp(6.8rem, 10vw, 8.75rem);
  height: clamp(4rem, 6vw, 5.25rem);
  object-fit: cover;
  border-radius: 6px;
}
</style>

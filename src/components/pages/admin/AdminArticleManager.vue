<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppImage from '@/components/common/AppImage.vue'
import AdminArticleEditorPanel from '@/components/pages/admin/components/AdminArticleEditorPanel.vue'
import { useAdminArticleManager } from '@/composables/pages/useAdminArticleManager'
import type { AdminArticleOrderingField } from '@/services/api/adminArticle'
import type { ArticleItem } from '@/types/article'
import { getArticleStatusLabel } from '@/utils/articleStatus'
import { resolveTempAsset } from '@/utils/assets'

const {
  loading,
  submitting,
  editorLoading,
  categories,
  list,
  total,
  page,
  pageSize,
  keyword,
  statusFilter,
  categoryFilter,
  handleKeywordInput,
  handleKeywordEnter,
  statusOptions,
  categoryOptions,
  editingId,
  editingFormValue,
  formatCategoryPath,
  getSortOrder,
  handleTableSortChange,
  handlePageChange,
  applyFilters,
  resetFilters,
  handleSubmit,
  handleArchive,
  handleCancelEditor,
  collectionBindingOpen,
  collectionBindingLoading,
  collectionBindingSubmitting,
  collectionBindingArticleTitle,
  collectionBindingValue,
  collectionBindingOptions,
  handleOpenCollectionBinding,
  handleCloseCollectionBinding,
  handleSaveCollectionBinding,
} = useAdminArticleManager()

const route = useRoute()
const router = useRouter()
const isEditorRoute = computed(() => route.path.startsWith('/admin/create_article/'))
const collectionBindingModalTitle = computed(() =>
  collectionBindingArticleTitle.value
    ? `配置合集归属：${collectionBindingArticleTitle.value}`
    : '配置合集归属',
)

interface CategoryDisplay {
  parent: string
  child: string | null
}

function splitCategoryPath(category: ArticleItem['category']): CategoryDisplay {
  const path = formatCategoryPath(category).trim()
  if (!path || path === '未分类') {
    return { parent: '未分类', child: null }
  }
  const parts = path
    .split(' - ')
    .map((item) => item.trim())
    .filter(Boolean)
  if (parts.length <= 1) {
    return { parent: parts[0] || '未分类', child: null }
  }
  return {
    parent: parts[0] || '未分类',
    child: parts.slice(1).join(' - '),
  }
}

const tableData = computed(() =>
  list.value.map((article) => ({
    ...article,
    categoryDisplay: splitCategoryPath(article.category),
  })),
)

function getCoverSrc(path?: string | null): string {
  if (!path) return '/img/hero-image.jpg'
  return resolveTempAsset(path)
}

function statusLabel(status: ArticleItem['status']): string {
  return getArticleStatusLabel(status)
}

function statusColor(status: ArticleItem['status']): string {
  if (status === 'draft') return 'default'
  if (status === 'published') return 'success'
  return 'warning'
}

function formatDateTime(input?: string | null): string {
  if (!input) return '-'
  return input.slice(0, 16).replace('T', ' ')
}

function titleSummary(summary?: string | null): string {
  const value = (summary || '').trim()
  if (!value) return '暂无摘要'
  const chars = Array.from(value)
  if (chars.length <= 46) return value
  return `${chars.slice(0, 46).join('')}...`
}

function handleCreate(): void {
  void router.push('/admin/create_article/')
}

function handleEdit(id: number): void {
  void router.push(`/admin/create_article/${id}/`)
}

function handlePreview(id: number): void {
  void router.push({ name: 'article-detail', params: { id } })
}

function handleDelete(id: number): void {
  void handleArchive(id)
}

function handleCollectionBinding(record: ArticleItem): void {
  void handleOpenCollectionBinding(record)
}

function showTotal(totalCount: number): string {
  return `总计 ${totalCount} 条`
}

type AntSortOrder = 'ascend' | 'descend' | null
type TableColumnKey = string | number | symbol | undefined
type TableFilterValue = string | number | boolean
type TableFiltersPayload = Record<string, ReadonlyArray<TableFilterValue> | null>
interface TablePaginationPayload {
  current?: number
  pageSize?: number
}
interface TableSorterPayload {
  columnKey?: TableColumnKey
  order?: AntSortOrder
}

function toOrderingField(columnKey: TableColumnKey): AdminArticleOrderingField | undefined {
  if (typeof columnKey !== 'string') return undefined
  if (columnKey === 'updated_at') return 'updated_at'
  if (columnKey === 'created_at') return 'created_at'
  if (columnKey === 'published_at') return 'published_at'
  if (columnKey === 'view_count') return 'view_count'
  if (columnKey === 'title') return 'title'
  if (columnKey === 'status') return 'status'
  return undefined
}

function handleTableChange(
  _pagination: TablePaginationPayload,
  _filters: TableFiltersPayload,
  sorter: TableSorterPayload | TableSorterPayload[],
): void {
  const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter
  const field = toOrderingField(currentSorter?.columnKey)
  handleTableSortChange(field, currentSorter?.order ?? null)
}
</script>

<template>
  <section class="admin-article-page">
    <AdminArticleEditorPanel
      v-if="isEditorRoute"
      :loading="editorLoading"
      :editing="Boolean(editingId)"
      :submitting="submitting"
      :category-options="categoryOptions"
      :category-tree="categories"
      :initial-value="editingFormValue"
      @submit="handleSubmit"
      @cancel="handleCancelEditor"
    />

    <template v-else>
      <div class="page-head">
        <div class="title-wrap">
          <h2>文章管理</h2>
          <p>共 {{ total }} 篇，单页固定 {{ pageSize }} 条</p>
        </div>
        <a-button type="primary" @click="handleCreate">新建文章</a-button>
      </div>

      <div class="filter-panel app-surface-card">
        <a-input
          :value="keyword"
          allow-clear
          class="filter-item keyword-input"
          placeholder="搜索标题 / 摘要 / slug"
          @update:value="handleKeywordInput"
          @press-enter="handleKeywordEnter"
        />
        <a-select
          v-model:value="statusFilter"
          allow-clear
          class="filter-item"
          placeholder="状态筛选"
          :options="statusOptions"
        />
        <a-select
          v-model:value="categoryFilter"
          allow-clear
          show-search
          option-filter-prop="label"
          class="filter-item category-select"
          placeholder="分类筛选"
          :options="categoryOptions"
        />
        <a-space>
          <a-button type="primary" @click="applyFilters">查找</a-button>
          <a-button @click="resetFilters">重置</a-button>
        </a-space>
      </div>

      <div class="table-card app-surface-card">
        <div class="table-tip">默认按发布时间倒序，点击列头可切换服务端排序</div>
        <a-table
          :data-source="tableData"
          :loading="loading"
          :pagination="false"
          row-key="id"
          size="middle"
          :sticky="true"
          :scroll="{ x: 1320 }"
          @change="handleTableChange"
        >
          <a-table-column title="缩略图" key="cover" :width="100" fixed="left">
            <template #default="{ record }">
              <AppImage :src="getCoverSrc(record.cover_path)" alt="cover" class="thumb" fallback-src="/img/hero-image.jpg" />
            </template>
          </a-table-column>
          <a-table-column title="文章" key="title" :width="350" :sorter="true" :sort-order="getSortOrder('title')">
            <template #default="{ record }">
              <div class="title-cell">
                <h4>{{ record.title }}</h4>
                <p>{{ titleSummary(record.summary) }}</p>
                <small>slug: {{ record.slug }}</small>
              </div>
            </template>
          </a-table-column>
          <a-table-column title="分类（父-子）" key="categoryPath" :width="220">
            <template #default="{ record }">
              <span class="category-cell">
                <span class="category-parent">{{ record.categoryDisplay.parent }}</span>
                <span v-if="record.categoryDisplay.child" class="category-child">{{ record.categoryDisplay.child }}</span>
              </span>
            </template>
          </a-table-column>
          <a-table-column title="作者" key="author" :width="120">
            <template #default="{ record }">
              {{ record.author?.username || '-' }}
            </template>
          </a-table-column>
          <a-table-column title="状态" key="status" :width="108" :sorter="true" :sort-order="getSortOrder('status')">
            <template #default="{ record }">
              <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="阅读" key="read_minutes" data-index="read_minutes" :width="90">
            <template #default="{ record }">
              {{ record.read_minutes }} 分钟
            </template>
          </a-table-column>
          <a-table-column
            title="浏览量"
            key="view_count"
            data-index="view_count"
            :width="90"
            :sorter="true"
            :sort-order="getSortOrder('view_count')"
          />
          <a-table-column title="发布时间" key="published_at" :width="170" :sorter="true" :sort-order="getSortOrder('published_at')">
            <template #default="{ record }">
              {{ formatDateTime(record.published_at) }}
            </template>
          </a-table-column>
          <a-table-column title="更新时间" key="updated_at" :width="170" :sorter="true" :sort-order="getSortOrder('updated_at')">
            <template #default="{ record }">
              {{ formatDateTime(record.updated_at) }}
            </template>
          </a-table-column>
          <a-table-column title="操作" key="actions" :width="270" fixed="right">
            <template #default="{ record }">
              <a-space>
                <a-button size="small" type="primary" ghost @click="handleEdit(record.id)">编辑</a-button>
                <a-button size="small" @click="handlePreview(record.id)">预览</a-button>
                <a-button size="small" @click="handleCollectionBinding(record)">合集</a-button>
                <a-popconfirm title="确定删除这篇文章吗？" ok-text="删除" cancel-text="取消" @confirm="handleDelete(record.id)">
                  <a-button size="small" danger>删除</a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </a-table>

        <div class="table-footer">
          <a-pagination
            :current="page"
            :page-size="pageSize"
            :total="total"
            :show-size-changer="false"
            :show-total="showTotal"
            @change="handlePageChange"
          />
        </div>
      </div>

      <a-modal
        :open="collectionBindingOpen"
        :title="collectionBindingModalTitle"
        :confirm-loading="collectionBindingSubmitting"
        ok-text="保存"
        cancel-text="取消"
        @ok="handleSaveCollectionBinding"
        @cancel="handleCloseCollectionBinding"
      >
        <a-spin :spinning="collectionBindingLoading">
          <a-form layout="vertical">
            <a-form-item label="归属合集（可多选）">
              <a-select
                v-model:value="collectionBindingValue"
                mode="multiple"
                allow-clear
                show-search
                option-filter-prop="label"
                :options="collectionBindingOptions"
                placeholder="选择该文章要纳入的合集"
              />
            </a-form-item>
            <p class="collection-bind-tip">
              已选择 {{ collectionBindingValue.length }} 个合集，保存后将同步更新文章与合集的多对多关系。
            </p>
          </a-form>
        </a-spin>
      </a-modal>
    </template>
  </section>
</template>

<style scoped>
.admin-article-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title-wrap h2 {
  margin: 0;
  color: var(--text);
  font-size: 1.38rem;
}

.title-wrap p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.86rem;
}

.filter-panel {
  padding: 14px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.filter-item {
  width: min(180px, 100%);
}

.keyword-input {
  width: min(300px, 100%);
}

.category-select {
  width: min(260px, 100%);
}

.table-card {
  padding: 0;
  overflow: hidden;
}

.table-tip {
  padding: 10px 16px;
  color: var(--muted);
  font-size: 0.8rem;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface-2) 45%, transparent);
}

.thumb {
  width: 68px;
  height: 42px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.title-cell {
  min-width: 0;
}

.title-cell h4 {
  margin: 0 0 4px;
  color: var(--text);
  font-size: 0.96rem;
  line-height: 1.4;
}

.title-cell p {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.title-cell small {
  color: var(--muted);
  font-size: 0.76rem;
}

.category-cell {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.category-parent,
.category-child {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.74rem;
  line-height: 1.35;
  border: 1px solid transparent;
}

.category-parent {
  color: var(--text);
  border-color: color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--surface-2) 68%, transparent);
}

.category-child {
  color: color-mix(in srgb, var(--text) 86%, #1677ff 14%);
  border-color: color-mix(in srgb, #1677ff 44%, transparent);
  background: color-mix(in srgb, #1677ff 14%, transparent);
}

.table-footer {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}

.collection-bind-tip {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

:deep(.ant-table-wrapper .ant-table) {
  background: transparent;
}

:deep(.ant-table-wrapper .ant-table-thead > tr > th) {
  color: var(--text);
  background: color-mix(in srgb, var(--surface-2) 62%, transparent);
  border-bottom: 1px solid var(--border);
}

:deep(.ant-table-wrapper .ant-table-sticky-holder) {
  z-index: 5;
}

:deep(.ant-table-wrapper .ant-table-tbody > tr > td) {
  border-bottom: 1px solid var(--border);
}

:deep(.ant-table-wrapper .ant-table-tbody > tr:hover > td) {
  background: color-mix(in srgb, var(--surface-2) 84%, transparent) !important;
}

@media (max-width: 980px) {
  .page-head {
    flex-direction: column;
    align-items: stretch;
  }

  .table-footer {
    justify-content: center;
  }
}
</style>

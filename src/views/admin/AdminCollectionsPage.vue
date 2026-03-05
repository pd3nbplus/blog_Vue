<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { Rule } from 'ant-design-vue/es/form'
import type { FormInstance } from 'ant-design-vue'
import type { SelectValue } from 'ant-design-vue/es/select'
import type { UploadProps } from 'ant-design-vue'
import { UploadOutlined } from '@ant-design/icons-vue'

import AppImage from '@/components/common/AppImage.vue'
import { useFeedback } from '@/composables/useFeedback'
import { uploadAdminMediaFile } from '@/services/api/admin'
import { getAdminArticleList } from '@/services/api/adminArticle'
import {
  createAdminCollection,
  deleteAdminCollection,
  getAdminCollectionDetail,
  getAdminCollectionList,
  updateAdminCollection,
} from '@/services/api/adminCollection'
import type { AdminCollectionPayload, CollectionItem } from '@/types/article'
import { resolveTempAsset } from '@/utils/assets'

const feedback = useFeedback()
const loading = ref(false)
const submitting = ref(false)
const list = ref<CollectionItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)
const keyword = ref('')
const pinnedFilter = ref<boolean | undefined>(undefined)

const modalOpen = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const formState = reactive<AdminCollectionPayload>({
  name: '',
  slug: '',
  summary: '',
  cover_path: '',
  is_pinned: false,
  order: 0,
  article_ids: [],
})

const articleOptions = ref<Array<{ label: string; value: number }>>([])
const articleOptionsLoading = ref(false)
const coverUploading = ref(false)
const statusOptions = [
  { label: '全部', value: 'all' },
  { label: '置顶', value: 'pinned' },
  { label: '非置顶', value: 'normal' },
]

const rules: Record<string, Rule[]> = {
  name: [{ required: true, message: '请输入合集名称', trigger: 'blur' }],
}

function formatDateTime(input?: string | null): string {
  if (!input) return '-'
  return input.slice(0, 16).replace('T', ' ')
}

function resolveCoverSrc(path?: string | null): string {
  return resolveTempAsset(path) || '/img/hero-image.jpg'
}

async function fetchCollections(targetPage = page.value) {
  loading.value = true
  try {
    const data = await getAdminCollectionList({
      page: targetPage,
      page_size: pageSize.value,
      q: keyword.value.trim() || undefined,
      is_pinned: pinnedFilter.value,
      ordering: '-updated_at',
    })
    list.value = data.results
    total.value = data.count
    page.value = data.page
    pageSize.value = data.page_size
  } catch (error) {
    feedback.error(error, '获取合集列表失败')
  } finally {
    loading.value = false
  }
}

async function fetchArticleOptions(search = '') {
  articleOptionsLoading.value = true
  try {
    const data = await getAdminArticleList({
      page: 1,
      page_size: 200,
      q: search.trim() || undefined,
      ordering: '-updated_at',
    })
    articleOptions.value = data.results.map((item) => ({
      label: `${item.title} (#${item.id})`,
      value: item.id,
    }))
  } catch (error) {
    feedback.error(error, '加载文章选项失败')
  } finally {
    articleOptionsLoading.value = false
  }
}

function resetForm() {
  formState.name = ''
  formState.slug = ''
  formState.summary = ''
  formState.cover_path = ''
  formState.is_pinned = false
  formState.order = 0
  formState.article_ids = []
}

function openCreate() {
  editingId.value = null
  resetForm()
  modalOpen.value = true
}

async function openEdit(id: number) {
  try {
    const detail = await getAdminCollectionDetail(id)
    editingId.value = id
    formState.name = detail.name
    formState.slug = detail.slug
    formState.summary = detail.summary || ''
    formState.cover_path = detail.cover_path || ''
    formState.is_pinned = detail.is_pinned
    formState.order = detail.order ?? 0
    formState.article_ids = detail.article_ids || []
    modalOpen.value = true
  } catch (error) {
    feedback.error(error, '加载合集详情失败')
  }
}

function buildUploadedMediaPath(path: string, name: string): string {
  const normalizedPath = path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const normalizedName = name.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalizedPath) return normalizedName
  if (!normalizedName) return normalizedPath
  return `${normalizedPath}/${normalizedName}`
}

async function uploadSelectedCover(file: File) {
  if (coverUploading.value) return
  coverUploading.value = true
  try {
    const result = await uploadAdminMediaFile({
      path: 'temp/uploads/collection-cover',
      file,
    })
    formState.cover_path = buildUploadedMediaPath(result.path, result.name)
    feedback.success('封面上传成功')
  } catch (error) {
    feedback.error(error, '封面上传失败')
  } finally {
    coverUploading.value = false
  }
}

const handleCoverBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  void uploadSelectedCover(file as File)
  return false
}

async function handleSubmit() {
  const form = formRef.value
  if (form?.validate) {
    await form.validate()
  }

  submitting.value = true
  try {
    const payload: AdminCollectionPayload = {
      name: formState.name.trim(),
      slug: formState.slug.trim(),
      summary: formState.summary.trim(),
      cover_path: formState.cover_path.trim(),
      is_pinned: formState.is_pinned,
      order: Number.isFinite(formState.order) ? formState.order : 0,
      article_ids: [...formState.article_ids],
    }
    if (editingId.value) {
      await updateAdminCollection(editingId.value, payload)
      feedback.success('合集更新成功')
    } else {
      await createAdminCollection(payload)
      feedback.success('合集创建成功')
    }
    modalOpen.value = false
    await fetchCollections(page.value)
  } catch (error) {
    feedback.error(error, '保存合集失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deleteAdminCollection(id)
    feedback.success('合集删除成功')
    await fetchCollections(page.value)
  } catch (error) {
    feedback.error(error, '删除合集失败')
  }
}

function handleSearch() {
  void fetchCollections(1)
}

function handleReset() {
  keyword.value = ''
  pinnedFilter.value = undefined
  void fetchCollections(1)
}

function handlePinnedFilterChange(value: SelectValue): void {
  const normalized = typeof value === 'string' ? value : undefined
  if (normalized === 'all' || normalized === undefined) {
    pinnedFilter.value = undefined
  } else if (normalized === 'pinned') {
    pinnedFilter.value = true
  } else if (normalized === 'normal') {
    pinnedFilter.value = false
  } else {
    pinnedFilter.value = undefined
  }
}

onMounted(async () => {
  await Promise.all([fetchCollections(1), fetchArticleOptions('')])
})
</script>

<template>
  <section class="collection-page">
    <div class="page-head">
      <div class="title-wrap">
        <h2>合集管理</h2>
        <p>支持一个文章归属于多个合集，置顶合集可展示在首页推荐区上方</p>
      </div>
      <a-button type="primary" @click="openCreate">新建合集</a-button>
    </div>

    <div class="filter-panel app-surface-card">
      <a-input
        v-model:value="keyword"
        allow-clear
        class="filter-item keyword-input"
        placeholder="搜索合集名称 / 概述 / slug"
        @press-enter="handleSearch"
      />
      <a-select
        class="filter-item"
        :options="statusOptions"
        :value="pinnedFilter === undefined ? 'all' : pinnedFilter ? 'pinned' : 'normal'"
        @change="handlePinnedFilterChange"
      />
      <a-space>
        <a-button type="primary" @click="handleSearch">查找</a-button>
        <a-button @click="handleReset">重置</a-button>
      </a-space>
    </div>

    <div class="table-card app-surface-card">
      <a-table :data-source="list" :loading="loading" :pagination="false" row-key="id" size="middle" :scroll="{ x: 1220 }">
        <a-table-column title="封面" key="cover" :width="100">
          <template #default="{ record }">
            <AppImage :src="resolveCoverSrc(record.cover_path)" alt="collection-cover" class="thumb" fallback-src="/img/hero-image.jpg" />
          </template>
        </a-table-column>
        <a-table-column title="合集" key="name" :width="260">
          <template #default="{ record }">
            <div class="name-cell">
              <strong>{{ record.name }}</strong>
              <small>slug: {{ record.slug }}</small>
            </div>
          </template>
        </a-table-column>
        <a-table-column title="概述" data-index="summary" :width="320" />
        <a-table-column title="置顶" key="is_pinned" :width="100">
          <template #default="{ record }">
            <a-tag :color="record.is_pinned ? 'success' : 'default'">{{ record.is_pinned ? '置顶' : '普通' }}</a-tag>
          </template>
        </a-table-column>
        <a-table-column title="排序" data-index="order" :width="80" />
        <a-table-column title="文章总数" data-index="article_count" :width="100" />
        <a-table-column title="浏览总量" data-index="total_views" :width="110" />
        <a-table-column title="更新时间" key="updated_at" :width="170">
          <template #default="{ record }">
            {{ formatDateTime(record.updated_at) }}
          </template>
        </a-table-column>
        <a-table-column title="操作" key="actions" :width="170" fixed="right">
          <template #default="{ record }">
            <a-space>
              <a-button size="small" type="primary" ghost @click="openEdit(record.id)">编辑</a-button>
              <a-popconfirm title="确定删除该合集吗？" ok-text="删除" cancel-text="取消" @confirm="handleDelete(record.id)">
                <a-button size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </a-table-column>
      </a-table>

      <div class="table-footer">
        <a-pagination :current="page" :page-size="pageSize" :total="total" :show-size-changer="false" @change="fetchCollections" />
      </div>
    </div>

    <a-modal
      :open="modalOpen"
      :title="editingId ? '编辑合集' : '新建合集'"
      :confirm-loading="submitting"
      ok-text="保存"
      cancel-text="取消"
      @ok="handleSubmit"
      @cancel="modalOpen = false"
    >
      <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical">
        <a-form-item label="合集名称" name="name">
          <a-input v-model:value="formState.name" />
        </a-form-item>
        <a-form-item label="slug">
          <a-input v-model:value="formState.slug" />
        </a-form-item>
        <a-form-item label="概述">
          <a-textarea v-model:value="formState.summary" :rows="3" />
        </a-form-item>
        <a-form-item label="封面路径">
          <a-input v-model:value="formState.cover_path" placeholder="支持本地路径或外链 URL">
            <template #addonAfter>
              <a-upload :show-upload-list="false" :before-upload="handleCoverBeforeUpload" :max-count="1" accept="image/*">
                <a-button type="link" size="small" :loading="coverUploading">
                  <UploadOutlined />
                  上传图片
                </a-button>
              </a-upload>
            </template>
          </a-input>
          <AppImage
            v-if="formState.cover_path"
            :src="resolveCoverSrc(formState.cover_path)"
            alt="collection-cover-preview"
            class="collection-cover-preview"
            fallback-src="/img/hero-image.jpg"
          />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="置顶">
              <a-switch v-model:checked="formState.is_pinned" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="排序">
              <a-input-number v-model:value="formState.order" :min="-999" :max="9999" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="关联文章（可多选）">
          <a-select
            v-model:value="formState.article_ids"
            mode="multiple"
            allow-clear
            show-search
            :filter-option="false"
            :options="articleOptions"
            :loading="articleOptionsLoading"
            placeholder="输入关键字可远程搜索文章"
            @search="fetchArticleOptions"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </section>
</template>

<style scoped>
.collection-page {
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
  width: min(200px, 100%);
}

.keyword-input {
  width: min(320px, 100%);
}

.table-card {
  padding: 0;
  overflow: hidden;
}

.thumb {
  width: 68px;
  height: 42px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name-cell strong {
  color: var(--text);
  line-height: 1.35;
}

.name-cell small {
  color: var(--muted);
  font-size: 0.76rem;
}

.table-footer {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}

:deep(.ant-table-wrapper .ant-table) {
  background: transparent;
}

:deep(.ant-table-wrapper .ant-table-thead > tr > th) {
  color: var(--text);
  background: color-mix(in srgb, var(--surface-2) 62%, transparent);
  border-bottom: 1px solid var(--border);
}

:deep(.ant-table-wrapper .ant-table-tbody > tr > td) {
  border-bottom: 1px solid var(--border);
}

.collection-cover-preview {
  margin-top: 8px;
  width: min(100%, 12rem);
  border-radius: 6px;
  border: 1px solid var(--border);
}
</style>

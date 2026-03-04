<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ReloadOutlined } from '@ant-design/icons-vue'

import { useFeedback } from '@/composables/useFeedback'
import { getAdminLogList } from '@/services/admin'
import type { AdminLogItem, AdminLogLevel, AdminLogSource } from '@/types/admin'

type LevelFilter = 'ALL' | AdminLogLevel
type SourceFilter = 'all' | AdminLogSource

const feedback = useFeedback()
const loading = ref(false)
const logs = ref<AdminLogItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const levelCounts = ref<Record<AdminLogLevel, number>>({
  DEBUG: 0,
  INFO: 0,
  WARNING: 0,
  ERROR: 0,
  CRITICAL: 0,
})

const keyword = ref('')
const levelFilter = ref<LevelFilter>('ALL')
const sourceFilter = ref<SourceFilter>('all')

const levelOptions = [
  { label: '全部等级', value: 'ALL' },
  { label: 'DEBUG', value: 'DEBUG' },
  { label: 'INFO', value: 'INFO' },
  { label: 'WARNING', value: 'WARNING' },
  { label: 'ERROR', value: 'ERROR' },
  { label: 'CRITICAL', value: 'CRITICAL' },
]

const sourceOptions = [
  { label: '全部来源', value: 'all' },
  { label: '审计日志', value: 'audit' },
  { label: '应用日志', value: 'application' },
  { label: 'Django日志', value: 'django' },
]

const pagination = computed(() => ({
  current: page.value,
  total: total.value,
  pageSize: pageSize.value,
  showSizeChanger: true,
  pageSizeOptions: ['20', '50', '100', '200'],
  showTotal: (num: number) => `共 ${num} 条`,
}))

function levelTagColor(level: AdminLogLevel): string {
  if (level === 'DEBUG') return 'default'
  if (level === 'INFO') return 'blue'
  if (level === 'WARNING') return 'orange'
  if (level === 'ERROR') return 'red'
  return 'magenta'
}

function levelTextClass(level: AdminLogLevel): string {
  return `level-text level-${level.toLowerCase()}`
}

function sourceTagColor(source: AdminLogSource): string {
  if (source === 'audit') return 'geekblue'
  if (source === 'application') return 'cyan'
  return 'default'
}

function sourceLabel(source: AdminLogSource): string {
  if (source === 'audit') return '审计'
  if (source === 'application') return '应用'
  return 'Django'
}

function rowClassName(record: AdminLogItem): string {
  return `log-row-${record.level.toLowerCase()}`
}

async function loadLogs(targetPage = page.value) {
  loading.value = true
  try {
    const data = await getAdminLogList({
      page: targetPage,
      page_size: pageSize.value,
      q: keyword.value.trim() || undefined,
      level: levelFilter.value === 'ALL' ? undefined : levelFilter.value,
      source: sourceFilter.value === 'all' ? undefined : sourceFilter.value,
    })
    logs.value = data.results
    total.value = data.count
    page.value = data.page
    pageSize.value = data.page_size
    levelCounts.value = data.level_counts
  } catch (error) {
    feedback.error(error, '加载日志失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  void loadLogs(1)
}

function handleReset() {
  keyword.value = ''
  levelFilter.value = 'ALL'
  sourceFilter.value = 'all'
  void loadLogs(1)
}

function handleTableChange(next: { current?: number; pageSize?: number }) {
  page.value = next.current || 1
  pageSize.value = next.pageSize || 50
  void loadLogs(page.value)
}

onMounted(() => {
  void loadLogs(1)
})
</script>

<template>
  <section class="logs-page">
    <div class="page-head">
      <div>
        <h2>日志管理</h2>
        <p>支持等级筛选、来源筛选和关键字检索，方便运维快速定位问题</p>
      </div>
      <a-space>
        <a-button @click="handleReset">重置筛选</a-button>
        <a-button type="primary" :loading="loading" @click="loadLogs(page)">
          <ReloadOutlined />
          刷新
        </a-button>
      </a-space>
    </div>

    <div class="filter-panel app-surface-card">
      <a-input
        v-model:value="keyword"
        class="filter-item keyword-input"
        allow-clear
        placeholder="搜索日志内容 / 位置"
        @press-enter="handleSearch"
      />
      <a-select v-model:value="levelFilter" class="filter-item" :options="levelOptions" />
      <a-select v-model:value="sourceFilter" class="filter-item" :options="sourceOptions" />
      <a-button type="primary" @click="handleSearch">查询</a-button>
    </div>

    <div class="summary-row app-surface-card">
      <a-tag color="default">DEBUG {{ levelCounts.DEBUG }}</a-tag>
      <a-tag color="blue">INFO {{ levelCounts.INFO }}</a-tag>
      <a-tag color="orange">WARNING {{ levelCounts.WARNING }}</a-tag>
      <a-tag color="red">ERROR {{ levelCounts.ERROR }}</a-tag>
      <a-tag color="magenta">CRITICAL {{ levelCounts.CRITICAL }}</a-tag>
    </div>

    <div class="table-card app-surface-card">
      <a-table
        row-key="id"
        size="middle"
        :data-source="logs"
        :loading="loading"
        :pagination="pagination"
        :row-class-name="rowClassName"
        :scroll="{ x: 1280 }"
        @change="handleTableChange"
      >
        <a-table-column title="时间" data-index="timestamp" :width="190" />
        <a-table-column title="等级" key="level" :width="110">
          <template #default="{ record }">
            <a-tag :color="levelTagColor(record.level)">
              <span :class="levelTextClass(record.level)">{{ record.level }}</span>
            </a-tag>
          </template>
        </a-table-column>
        <a-table-column title="来源" key="source" :width="100">
          <template #default="{ record }">
            <a-tag :color="sourceTagColor(record.source)">{{ sourceLabel(record.source) }}</a-tag>
          </template>
        </a-table-column>
        <a-table-column title="位置" key="location" :width="260">
          <template #default="{ record }">
            <code class="location-code">{{ record.location }}</code>
          </template>
        </a-table-column>
        <a-table-column title="内容" key="message">
          <template #default="{ record }">
            <pre class="message-pre">{{ record.message }}</pre>
          </template>
        </a-table-column>
        <a-table-column title="文件" data-index="file" :width="170" />
      </a-table>
    </div>
  </section>
</template>

<style scoped>
.logs-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.page-head h2 {
  margin: 0;
  color: var(--text);
  font-size: 1.22rem;
}

.page-head p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.filter-panel {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
  flex-wrap: wrap;
}

.filter-item {
  min-width: 130px;
}

.keyword-input {
  min-width: min(460px, 100%);
}

.summary-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  flex-wrap: wrap;
}

.table-card {
  padding: 10px;
}

.location-code {
  font-size: 14px;
  color: var(--muted);
  word-break: break-all;
  line-height: 1.5;
}

.message-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text);
  font-size: 12px;
  line-height: 1.45;
  max-height: 9rem;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.level-text {
  font-weight: 700;
}

.level-debug {
  color: var(--muted);
}

.level-info {
  color: #1677ff;
}

.level-warning {
  color: #d48806;
}

.level-error {
  color: #cf1322;
}

.level-critical {
  color: #c41d7f;
}

:deep(.log-row-warning td) {
  background: color-mix(in srgb, #faad14 12%, var(--surface));
}

:deep(.log-row-error td) {
  background: color-mix(in srgb, #ff4d4f 9%, var(--surface));
}

:deep(.log-row-critical td) {
  background: color-mix(in srgb, #eb2f96 10%, var(--surface));
}

@media (max-width: 900px) {
  .page-head {
    flex-direction: column;
  }

  .keyword-input {
    min-width: 100%;
  }
}
</style>

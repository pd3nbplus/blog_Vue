<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { useFeedback } from '@/composables/useFeedback'
import { approveAdminComment, deleteAdminComment, getAdminCommentList } from '@/services/admin'
import type { AdminCommentItem } from '@/types/admin'

const feedback = useFeedback()
const loading = ref(false)
const keyword = ref('')
const list = ref<AdminCommentItem[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const visiblePages = computed(() => {
  const current = page.value
  const start = Math.max(1, current - 2)
  const end = Math.min(totalPages.value, current + 2)
  const pages: number[] = []
  for (let i = start; i <= end; i += 1) pages.push(i)
  return pages
})

function rowIndex(index: number): number {
  return (page.value - 1) * pageSize.value + index + 1
}

async function loadComments(currentPage = 1) {
  loading.value = true
  try {
    const data = await getAdminCommentList({
      page: currentPage,
      page_size: pageSize.value,
      q: keyword.value.trim() || undefined,
    })
    list.value = data.results
    total.value = data.count
    page.value = data.page
    pageSize.value = data.page_size
  } catch (error) {
    feedback.error(error)
  } finally {
    loading.value = false
  }
}

function handleSearchSubmit(event: Event) {
  event.preventDefault()
  void loadComments(1)
}

function handlePageChange(nextPage: number) {
  void loadComments(nextPage)
}

async function handleApprove(item: AdminCommentItem) {
  try {
    await approveAdminComment(item.id, !item.is_approved)
    feedback.success('评论状态已更新')
    await loadComments(page.value)
  } catch (error) {
    feedback.error(error)
  }
}

async function handleDelete(item: AdminCommentItem) {
  if (!window.confirm('确定要删除该评论吗？')) return
  try {
    await deleteAdminComment(item.id)
    feedback.success('评论删除成功')
    await loadComments(page.value)
  } catch (error) {
    feedback.error(error)
  }
}

onMounted(() => {
  void loadComments()
})
</script>

<template>
  <section class="comments-page">
    <div class="container mt-5">
      <div class="admin-head-row">
        <h2>评论管理</h2>
        <form class="form-inline" @submit="handleSearchSubmit">
          <input v-model.trim="keyword" class="form-control" type="search" placeholder="搜索评论" />
          <button class="btn btn-outline-success" type="submit">搜索</button>
        </form>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">序号</th>
              <th scope="col">文章</th>
              <th scope="col">用户</th>
              <th scope="col">评论内容</th>
              <th scope="col">审核</th>
              <th scope="col">时间</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="empty-cell">加载中...</td>
            </tr>
            <tr v-else-if="list.length === 0">
              <td colspan="7" class="empty-cell">暂无评论</td>
            </tr>
            <tr v-for="(item, index) in list" :key="item.id">
              <td>{{ rowIndex(index) }}</td>
              <td>{{ item.article?.title || '-' }}</td>
              <td>
                {{ item.author_name }}
                <div class="email">{{ item.author_email }}</div>
              </td>
              <td>{{ item.content }}</td>
              <td>{{ item.is_approved ? '已通过' : '待审核' }}</td>
              <td>{{ item.created_at }}</td>
              <td>
                <button class="btn btn-sm btn-warning" type="button" @click="handleApprove(item)">
                  {{ item.is_approved ? '撤销' : '通过' }}
                </button>
                <button class="btn btn-sm btn-danger" type="button" @click="handleDelete(item)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-wrap">
        <nav aria-label="Page navigation">
          <ul class="pagination">
            <li v-if="page > 1" class="page-item">
              <a href="#" class="page-link" @click.prevent="handlePageChange(1)">首页</a>
            </li>
            <li v-if="page > 1" class="page-item">
              <a href="#" class="page-link" @click.prevent="handlePageChange(page - 1)">上一页</a>
            </li>

            <li v-for="num in visiblePages" :key="num" class="page-item" :class="{ active: page === num }">
              <a v-if="page !== num" href="#" class="page-link" @click.prevent="handlePageChange(num)">{{ num }}</a>
              <span v-else class="page-link">{{ num }}</span>
            </li>

            <li v-if="page < totalPages" class="page-item">
              <a href="#" class="page-link" @click.prevent="handlePageChange(page + 1)">下一页</a>
            </li>
            <li v-if="page < totalPages" class="page-item">
              <a href="#" class="page-link" @click.prevent="handlePageChange(totalPages)">末页</a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </section>
</template>

<style scoped>
.comments-page {
  width: 100%;
}

.container {
  width: 95%;
  margin: 0 auto;
  max-width: none;
}

.admin-head-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 10px;
}

.admin-head-row h2 {
  margin: 0;
}

.form-inline {
  display: flex;
  gap: 8px;
}

.form-control {
  width: clamp(12rem, 28vw, 18rem);
  padding: 8px 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 4px;
}

.btn {
  border: none;
  border-radius: 4px;
  padding: 8px 14px;
  cursor: pointer;
}

.btn-outline-success {
  background: var(--btn-success);
  color: var(--btn-text-on-success);
}

.btn-warning {
  background: var(--btn-warning);
  color: var(--btn-text-on-warning);
}

.btn-danger {
  background: var(--btn-danger);
  color: var(--btn-text-on-danger);
}

.btn-sm {
  padding: 6px 10px;
  font-size: 13px;
}

.table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 10px;
  overflow: hidden;
  background-color: var(--surface);
  color: var(--muted);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
}

.table thead th {
  background-color: var(--surface);
  color: var(--text);
}

.table tr:hover td {
  background-color: color-mix(in srgb, var(--surface-2) 85%, transparent);
  color: var(--text);
}

.table th,
.table td {
  padding: 15px;
  text-align: left;
  font-size: 15px;
  vertical-align: middle;
}

.table thead {
  border-bottom: 2px solid var(--border);
}

.empty-cell {
  text-align: center;
  color: var(--muted);
}

.email {
  font-size: 12px;
  color: var(--muted);
}

.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.page-link {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  text-decoration: none;
}

.page-item.active .page-link {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--btn-text-on-primary);
}

@media (max-width: 900px) {
  .form-control {
    width: 100%;
  }
}
</style>

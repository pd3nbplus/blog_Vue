<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useFeedback } from '@/composables/useFeedback'
import { getAdminDashboardSummary } from '@/services/adminArticle'
import { useUserStore } from '@/stores/modules/user'
import type { AdminDashboardSummary } from '@/types/admin'

const feedback = useFeedback()
const userStore = useUserStore()
const route = useRoute()
const loading = ref(false)
const summary = ref<AdminDashboardSummary | null>(null)

const username = computed(() => userStore.profile?.username || 'admin')
const categoryRows = computed(() => Object.entries(summary.value?.category_articles || {}))
const maxCategoryCount = computed(() => {
  const counts = categoryRows.value.map(([, count]) => count)
  return counts.length ? Math.max(...counts) : 1
})

function barWidth(count: number): string {
  return `${Math.max(8, Math.round((count / maxCategoryCount.value) * 100))}%`
}

async function loadSummary() {
  loading.value = true
  try {
    summary.value = await getAdminDashboardSummary()
  } catch (error) {
    feedback.error(error)
  } finally {
    loading.value = false
  }
}

watch(
  () => route.path,
  (path) => {
    if (path === '/admin/dashboard/') {
      void loadSummary()
    }
  },
  { immediate: true },
)

onActivated(() => {
  if (route.path === '/admin/dashboard/') {
    void loadSummary()
  }
})
</script>

<template>
  <div class="container">
    <section class="header-section">
      <h1 class="display-4">脚踏实地，笃志前行</h1>
      <p class="lead">pdnbplus-blog后台管理系统: 欢迎您, {{ username }}</p>
    </section>

    <li class="li-title">Data Statistics of this site</li>
    <section class="stats-grid" :class="{ loading }">
      <article class="stat-card bg-primary">
        <img src="/img/user.png" alt="users" class="img-fluid" />
        <div class="card-body">
          <h2><span>{{ summary?.user_count ?? 0 }}</span>人</h2>
          <p>注册用户</p>
        </div>
      </article>
      <article class="stat-card bg-danger">
        <img src="/img/article.png" alt="articles" class="img-fluid" />
        <div class="card-body">
          <h2><span>{{ summary?.article_count ?? 0 }}</span>篇</h2>
          <p>本站文章</p>
        </div>
      </article>
      <article class="stat-card bg-success">
        <img src="/img/category-group.png" alt="categories" class="img-fluid" />
        <div class="card-body">
          <h2><span>{{ summary?.category_count ?? 0 }}</span>组</h2>
          <p>本站分类</p>
        </div>
      </article>
      <article class="stat-card bg-info">
        <img src="/img/total-views.png" alt="views" class="img-fluid" />
        <div class="card-body">
          <h2><span>{{ summary?.total_views ?? 0 }}</span>w</h2>
          <p>访问总量</p>
        </div>
      </article>
    </section>

    <li class="li-title">Data display of articles in this site</li>
    <section class="data-display">
      <div class="chart-panel">
        <h3>文章分类统计</h3>
        <div class="bar-list">
          <div v-for="[name, count] in categoryRows" :key="name" class="bar-item">
            <span class="bar-name">{{ name }}</span>
            <div class="bar-track">
              <div class="bar-value" :style="{ width: barWidth(count) }" />
            </div>
            <span class="bar-count">{{ count }}</span>
          </div>
          <p v-if="!categoryRows.length" class="empty-tip">暂无分类数据</p>
        </div>
      </div>

      <div class="quick-links">
        <a class="quick-card" href="#" @click.prevent="$router.push('/admin/create_article/')">
          <img src="/img/pen.png" alt="new article" />
          <p>新建文章</p>
        </a>
        <a class="quick-card" href="#" @click.prevent="$router.push('/admin/manage_categories/')">
          <img src="/img/manage-category.png" alt="new category" />
          <p>新建分类</p>
        </a>
        <a class="quick-card" href="#" @click.prevent="$router.push('/admin/pic_management/')">
          <img src="/img/media-library.png" alt="media" />
          <p>媒体库</p>
        </a>
        <a class="quick-card" href="#" @click.prevent="$router.push('/admin/manage_logs/')">
          <img src="/img/log.png" alt="log" />
          <p>查看日志</p>
        </a>
        <a class="quick-card" href="#">
          <img src="/img/user.png" alt="user" />
          <p>用户管理</p>
        </a>
        <a class="quick-card" href="#" @click.prevent="$router.push('/admin/dashboard/super_admin/')">
          <img src="/img/super-admin.png" alt="super" />
          <p>超级后台</p>
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.container {
  width: 100%;
  padding: 0.25rem 0.5rem 1rem;
}

.header-section {
  background-image: url('/img/background.jpg');
  background-size: cover;
  background-position: center;
  color: var(--text);
  padding: clamp(1.8rem, 4vw, 3rem) 0;
  margin: 0 2px 16px;
  border-radius: var(--radius);
  text-align: center;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
}

.display-4 {
  color: var(--text);
  font-weight: 700;
  font-size: clamp(1.8rem, 3.6vw, 3.2rem);
  margin: 0;
}

.lead {
  color: var(--muted);
  font-size: clamp(1rem, 1.8vw, 1.3rem);
  font-weight: 500;
  margin: 8px 0 0;
}

.li-title {
  font-size: 1.5rem;
  margin-bottom: 10px;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.li-title::before {
  content: '•';
  font-size: 1.25em;
  line-height: 1;
  color: var(--accent);
  flex: 0 0 auto;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(240px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 0;
  border-radius: 10px;
  color: var(--text-on-colored);
  min-height: clamp(8.8rem, 16vw, 10.5rem);
  padding: 12px;
}

.stat-card:hover {
  box-shadow: var(--tile-hover-shadow);
  transform: scale(1.03);
}

.img-fluid {
  margin: auto 1rem;
  width: clamp(3.4rem, 7vw, 6rem);
  height: clamp(3.4rem, 7vw, 6rem);
}

.card-body {
  margin: 10px 8% 10px 0;
}

.card-body span {
  font-size: clamp(1.6rem, 3.1vw, 2.4rem);
  font-weight: bold;
}

.card-body h2 {
  margin: 0;
  font-size: 1.5rem;
}

.card-body p {
  margin: 6px 0 0;
}

.bg-primary {
  background: var(--stat-gradient-1);
}

.bg-danger {
  background: var(--stat-gradient-2);
}

.bg-success {
  background: var(--stat-gradient-3);
}

.bg-info {
  background: var(--stat-gradient-4);
}

.data-display {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.chart-panel {
  background: var(--surface);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
  padding: 18px;
}

.chart-panel h3 {
  margin: 0 0 12px;
}

.bar-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bar-item {
  display: grid;
  grid-template-columns: minmax(5rem, 9rem) 1fr auto;
  gap: 8px;
  align-items: center;
}

.bar-name,
.bar-count {
  color: var(--muted);
  font-size: 14px;
}

.bar-track {
  height: 0.65rem;
  border-radius: 999px;
  background: var(--surface-2);
}

.bar-value {
  height: 100%;
  border-radius: 999px;
  background: var(--chart-bar-gradient);
}

.quick-links {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.quick-card {
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: clamp(8.8rem, 16vw, 10.5rem);
}

.quick-card:hover {
  transform: scale(1.03);
  text-decoration: none;
}

.quick-card img {
  height: clamp(2.8rem, 6vw, 5rem);
  width: clamp(2.8rem, 6vw, 5rem);
  object-fit: contain;
}

.quick-card p {
  margin: 12px 0 0;
  font-size: clamp(1rem, 1.8vw, 1.35rem);
  font-weight: bold;
  color: var(--text);
}

.empty-tip {
  color: var(--muted);
}

@media (max-width: 1280px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }

  .data-display {
    grid-template-columns: 1fr;
  }
}
</style>

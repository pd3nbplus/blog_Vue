<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useTheme, type AppTheme } from '@/composables/useTheme'
import { useUserStore } from '@/stores/modules/user'

const route = useRoute()
const userStore = useUserStore()
const { currentTheme, themeOptions, setTheme } = useTheme()
const username = computed(() => userStore.profile?.username || 'admin')
const routeViewKey = computed(() => route.path)

const navItems = [
  { label: '仪表盘', path: '/admin/dashboard/' },
  { label: '文章管理', path: '/admin/manage_articles/?page=1' },
  { label: '合集管理', path: '/admin/manage_collections/' },
  { label: '评论管理', path: '/admin/manage_comments/' },
  { label: '分类管理', path: '/admin/manage_categories/' },
  { label: '媒体库', path: '/admin/pic_management/' },
  { label: '日志管理', path: '/admin/manage_logs/' },
  { label: '个人设置', path: '/admin/personal_settings/' },
]

function isActive(path: string): boolean {
  const basePath = path.split('?')[0] ?? ''
  if (basePath === '/admin/manage_articles/' && route.path.startsWith('/admin/create_article/')) {
    return true
  }
  return route.path.startsWith(basePath)
}

function handleThemeChange(event: Event) {
  const select = event.target as HTMLSelectElement
  setTheme(select.value as AppTheme)
}
</script>

<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :class="{ active: isActive(item.path) }"
      >
        {{ item.label }}
      </RouterLink>
    </aside>

    <header class="topbar">
      <div class="theme-switcher">
        <label for="admin-theme-picker">主题</label>
        <select id="admin-theme-picker" :value="currentTheme" @change="handleThemeChange">
          <option v-for="item in themeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
      </div>
      <div class="user-info">
        <img src="/img/user_avatar.png" alt="User Avatar" />
        <span class="username">{{ username }}</span>
      </div>
      <RouterLink to="/">返回首页</RouterLink>
      <RouterLink to="/admin/logout/">
        <img src="/img/logout-icon.png" alt="Logout" />
        <span>&nbsp;退出</span>
      </RouterLink>
    </header>

    <main class="content">
      <router-view :key="routeViewKey" />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: grid;
  grid-template-columns: var(--admin-sidebar-width) minmax(0, 1fr);
  grid-template-rows: var(--admin-topbar-height) minmax(0, 1fr);
  grid-template-areas:
    'sidebar topbar'
    'sidebar content';
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-main);
  --admin-sidebar-width: clamp(12.5rem, 17vw, 16.5rem);
  --admin-topbar-height: clamp(3.25rem, 4vw, 3.9rem);
  --admin-sidebar-nav-offset: clamp(4.8rem, 9.5vh, 6.8rem);
}

.sidebar {
  grid-area: sidebar;
  width: auto;
  background: var(--surface);
  color: var(--muted);
  border-right: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  padding: var(--admin-sidebar-nav-offset) clamp(0.35rem, 0.9vw, 0.55rem) 0;
}

.sidebar a {
  color: inherit;
  padding: 0.85rem 0.95rem;
  text-decoration: none;
  display: block;
  font-size: 1rem;
  font-weight: 700;
}

.sidebar a:hover,
.sidebar a.active {
  background: var(--surface-2);
  color: var(--primary);
  border-radius: 8px;
}

.topbar {
  grid-area: topbar;
  min-height: var(--admin-topbar-height);
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  border-bottom: 1px solid var(--border);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 1rem;
  position: sticky;
  top: 0;
  z-index: 20;
  font-size: 1rem;
  font-weight: 600;
  backdrop-filter: blur(8px);
  gap: 0.6rem;
}

.theme-switcher {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-right: auto;
  padding: 0 0.55rem;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-2) 85%, transparent);
}

.theme-switcher label {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}

.theme-switcher select {
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  padding: 0 0.45rem;
  line-height: 1;
}

.topbar .user-info {
  display: flex;
  align-items: center;
}

.topbar .user-info img {
  border-radius: 50%;
  width: clamp(1.9rem, 2.8vw, 2.5rem);
  height: clamp(1.9rem, 2.8vw, 2.5rem);
  margin-left: 0.6rem;
}

.topbar a {
  color: inherit;
  margin-left: 0.8rem;
  padding: 0.45rem 0.65rem;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
}

.topbar a img {
  width: clamp(1rem, 2vw, 1.4rem);
  height: clamp(1rem, 2vw, 1.4rem);
}

.topbar a:hover {
  background: var(--surface-2);
  color: var(--primary);
}

.content {
  grid-area: content;
  margin: 0;
  padding: 1rem;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
}

.username {
  margin-left: 0.6rem;
}

@media (max-width: 1024px) {
  .admin-layout {
    display: block;
  }

  .sidebar {
    position: static;
    width: 100%;
    height: auto;
    flex-direction: row;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .sidebar a {
    white-space: nowrap;
    padding: 0.75rem;
  }

  .topbar {
    position: static;
    min-height: auto;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.6rem 0.75rem;
  }

  .theme-switcher {
    margin-right: 0;
  }

  .content {
    margin: 0;
    min-height: auto;
    padding: 0.8rem;
  }
}
</style>

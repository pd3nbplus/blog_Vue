<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useUserStore } from '@/stores/modules/user'

const router = useRouter()
const userStore = useUserStore()
const username = computed(() => userStore.profile?.username || '游客')

async function handleLogout() {
  await userStore.doLogout()
  await router.push({ name: 'home' })
}
</script>

<template>
  <a-layout-header class="app-header">
    <div class="brand" @click="$router.push({ name: 'home' })">Blog Project</div>
    <a-space>
      <a-button type="link" @click="$router.push({ name: 'article-list' })">文章</a-button>
      <template v-if="userStore.isLoggedIn">
        <span>{{ username }}</span>
        <a-button @click="handleLogout">退出</a-button>
      </template>
      <a-button v-else type="primary" @click="$router.push({ name: 'login' })">登录</a-button>
    </a-space>
  </a-layout-header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  color: var(--text);
  border-bottom: 1px solid var(--border);
}

.brand {
  cursor: pointer;
  font-size: 20px;
  font-weight: 700;
}
</style>

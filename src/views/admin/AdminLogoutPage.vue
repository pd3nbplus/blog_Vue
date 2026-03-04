<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useUserStore } from '@/stores/modules/user'

const router = useRouter()
const userStore = useUserStore()

onMounted(async () => {
  await userStore.doLogout()
  await router.replace({ name: 'admin-login' })
})
</script>

<template>
  <div />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { ArticleStatus } from '@/types/article'

interface StatusOption {
  label: string
  value: ArticleStatus
}

const props = defineProps<{
  keyword: string
  statusFilter?: ArticleStatus
  statusOptions: StatusOption[]
}>()

const emit = defineEmits<{
  (e: 'update:keyword', value: string): void
  (e: 'update:statusFilter', value: ArticleStatus | undefined): void
  (e: 'search'): void
}>()

const keywordValue = computed({
  get: () => props.keyword,
  set: (value: string) => emit('update:keyword', value),
})

const statusValue = computed({
  get: () => props.statusFilter,
  set: (value: ArticleStatus | undefined) => emit('update:statusFilter', value),
})
</script>

<template>
  <div class="filters">
    <a-input v-model:value="keywordValue" placeholder="搜索标题/摘要/slug" class="keyword-input" />
    <a-select
      v-model:value="statusValue"
      allow-clear
      placeholder="状态筛选"
      :options="statusOptions"
      class="status-select"
    />
    <a-button @click="emit('search')">搜索</a-button>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
  width: 100%;
}

.keyword-input {
  width: clamp(12rem, 28vw, 18rem);
}

.status-select {
  width: clamp(9rem, 20vw, 13rem);
}

@media (max-width: 900px) {
  .filters {
    flex-wrap: wrap;
  }

  .keyword-input,
  .status-select {
    width: 100%;
  }
}
</style>

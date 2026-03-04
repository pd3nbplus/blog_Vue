<script setup lang="ts">
defineProps<{
  page: number
  pageSize: number
  total: number
}>()

const emit = defineEmits<{
  (e: 'change', page: number): void
  (e: 'size-change', page: number, size: number): void
}>()

function handleChange(page: number): void {
  emit('change', page)
}

function handleSizeChange(page: number, size: number): void {
  emit('size-change', page, size)
}
</script>

<template>
  <div class="pagination-wrap">
    <a-pagination
      :current="page"
      :page-size="pageSize"
      :total="total"
      show-size-changer
      @change="handleChange"
      @show-size-change="handleSizeChange"
    />
  </div>
</template>

<style scoped>
.pagination-wrap {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}
</style>

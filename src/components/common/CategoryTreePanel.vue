<script setup lang="ts">
import { computed, ref } from 'vue'

import type { CategoryItem } from '@/types/article'
import { resolveTempAsset } from '@/utils/assets'

interface Props {
  categories: CategoryItem[]
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '文章分类',
})

const emit = defineEmits<{
  select: [categoryId: number]
}>()

const openedCategories = ref<number[]>([])

const topCategories = computed(() => props.categories.filter((item) => item.level === 1))

function isOpened(id: number): boolean {
  return openedCategories.value.includes(id)
}

function toggleCategory(id: number): void {
  if (isOpened(id)) {
    openedCategories.value = openedCategories.value.filter((item) => item !== id)
    return
  }
  openedCategories.value.push(id)
}

function categoryIcon(path?: string | null): string {
  return resolveTempAsset(path)
}

function handleSelect(categoryId: number): void {
  emit('select', categoryId)
}
</script>

<template>
  <div class="categories">
    <div class="categories-title">
      <h2>{{ title }}</h2>
    </div>
    <ul>
      <li v-for="category in topCategories" :key="category.id" class="category-item">
        <a href="javascript:void(0);" @click.prevent="toggleCategory(category.id)">
          <img v-if="categoryIcon(category.icon_path)" :src="categoryIcon(category.icon_path)" alt="icon" class="category-icon" />
          {{ category.name }}
        </a>
        <ul v-show="isOpened(category.id)" class="subcategory-list">
          <li v-for="subcategory in category.children || []" :key="subcategory.id">
            <a href="javascript:void(0);" @click.prevent="handleSelect(subcategory.id)">
              <img v-if="categoryIcon(subcategory.icon_path)" :src="categoryIcon(subcategory.icon_path)" alt="icon" class="category-icon" />
              {{ subcategory.name }}
            </a>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { CaretRightFilled, DeleteOutlined, DownCircleOutlined, EditOutlined, PlusOutlined, RightCircleOutlined, UploadOutlined } from '@ant-design/icons-vue'
import type { UploadProps } from 'ant-design-vue'

import { useFeedback } from '@/composables/useFeedback'
import { createAdminCategory, deleteAdminCategory, getAdminCategoryTree, updateAdminCategory } from '@/services/admin'
import type { CategoryItem } from '@/types/article'
import { resolveTempAsset } from '@/utils/assets'

type ModalAction = 'create' | 'edit' | 'create_parent'

interface CategoryTreeRow {
  item: CategoryItem
  depth: number
  hasChildren: boolean
}

const feedback = useFeedback()
const loading = ref(false)
const categories = ref<CategoryItem[]>([])
const expanded = ref<Set<number>>(new Set())

const modal = reactive({
  visible: false,
  action: 'create' as ModalAction,
  categoryId: null as number | null,
  name: '',
})

const iconFile = ref<File | null>(null)
const iconUploadList = ref<Array<{ uid: string; name: string; status: 'done' }>>([])

const categoryMap = computed(() => {
  const map = new Map<number, CategoryItem>()
  const walk = (items: CategoryItem[]) => {
    for (const item of items) {
      map.set(item.id, item)
      if (item.children?.length) {
        walk(item.children)
      }
    }
  }
  walk(categories.value)
  return map
})

const selectedCategory = computed(() => {
  const id = modal.categoryId
  if (!id) return null
  return categoryMap.value.get(id) || null
})

const visibleRows = computed<CategoryTreeRow[]>(() => {
  const rows: CategoryTreeRow[] = []

  const walk = (items: CategoryItem[], depth: number) => {
    for (const item of items) {
      const hasChildren = Boolean(item.children?.length)
      rows.push({ item, depth, hasChildren })
      if (hasChildren && expanded.value.has(item.id)) {
        walk(item.children || [], depth + 1)
      }
    }
  }

  walk(categories.value, 0)
  return rows
})

function getIcon(path?: string): string | null {
  if (!path) return null
  return resolveTempAsset(path)
}

function resetExpanded() {
  expanded.value = new Set()
}

async function loadCategories() {
  loading.value = true
  try {
    const data = await getAdminCategoryTree()
    categories.value = data
    resetExpanded()
  } catch (error) {
    feedback.error(error)
  } finally {
    loading.value = false
  }
}

function isExpanded(id: number): boolean {
  return expanded.value.has(id)
}

function toggleCategory(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expanded.value = next
}

function openModal(action: ModalAction, categoryId: number | null = null) {
  if (action === 'create' && categoryId) {
    const parent = categoryMap.value.get(categoryId)
    if (parent?.parent) {
      feedback.error('二级分类下不允许再创建子分类')
      return
    }
  }
  modal.visible = true
  modal.action = action
  modal.categoryId = action === 'create_parent' ? null : categoryId
  modal.name = action === 'edit' ? categoryMap.value.get(categoryId || -1)?.name || '' : ''
  iconFile.value = null
  iconUploadList.value = []
}

function closeModal() {
  modal.visible = false
  modal.name = ''
  iconFile.value = null
  iconUploadList.value = []
}

const handleIconBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  iconFile.value = file as File
  iconUploadList.value = [{ uid: (file as File).name, name: (file as File).name, status: 'done' }]
  return false
}

const handleIconRemove: UploadProps['onRemove'] = () => {
  iconFile.value = null
  iconUploadList.value = []
  return true
}

async function handleDelete(categoryId: number) {
  if (!window.confirm('确定要删除该分类吗？')) return
  try {
    await deleteAdminCategory(categoryId)
    feedback.success('分类删除成功')
    await loadCategories()
  } catch (error) {
    feedback.error(error)
  }
}

async function handleModalSubmit(event: Event) {
  event.preventDefault()
  if (!modal.name.trim()) {
    feedback.error('分类名称不能为空')
    return
  }

  try {
    if (modal.action === 'create_parent') {
      await createAdminCategory({
        name: modal.name.trim(),
        iconFile: iconFile.value,
      })
    } else if (modal.action === 'create') {
      if (!modal.categoryId) {
        feedback.error('未识别父分类')
        return
      }
      const parent = categoryMap.value.get(modal.categoryId)
      if (parent?.parent) {
        feedback.error('二级分类下不允许再创建子分类')
        return
      }
      await createAdminCategory({
        name: modal.name.trim(),
        parent: modal.categoryId,
        iconFile: iconFile.value,
      })
    } else {
      if (!modal.categoryId) {
        feedback.error('未识别待编辑分类')
        return
      }
      await updateAdminCategory(modal.categoryId, {
        name: modal.name.trim(),
        iconFile: iconFile.value,
      })
    }

    feedback.success('分类保存成功')
    closeModal()
    await loadCategories()
  } catch (error) {
    feedback.error(error)
  }
}

onMounted(() => {
  void loadCategories()
})
</script>

<template>
  <section class="category-tree-container" :class="{ loading }">
    <div class="page-head app-surface-card">
      <div class="head-title">
        <h2>分类管理</h2>
        <p>默认全部折叠，仅支持二级分类结构</p>
      </div>
      <button class="btn btn-primary create-parent-btn" @click="openModal('create_parent')">
        <PlusOutlined class="action-icon" />
        新建父分类
      </button>
    </div>

    <div class="tree-card app-surface-card">
      <div v-if="!visibleRows.length" class="empty-tip">暂无分类数据</div>

      <div v-for="row in visibleRows" :key="row.item.id" class="tree-row">
        <div class="tree-left" :style="{ paddingLeft: `${12 + row.depth * 24}px` }">
          <button
            v-if="row.hasChildren"
            class="toggle-btn"
            type="button"
            :aria-label="isExpanded(row.item.id) ? '收起节点' : '展开节点'"
            @click="toggleCategory(row.item.id)"
          >
            <DownCircleOutlined v-if="isExpanded(row.item.id)" class="toggle-arrow expanded" />
            <RightCircleOutlined v-else class="toggle-arrow" />
          </button>
          <span v-else class="toggle-placeholder" aria-hidden="true" />

          <CaretRightFilled v-if="row.depth > 0" class="child-prefix-icon" aria-hidden="true" />
          <img
            v-if="getIcon(row.item.icon_path)"
            :src="getIcon(row.item.icon_path) || ''"
            alt=""
            class="category-icon"
          />
          <span class="category-name">{{ row.item.name }}</span>
        </div>

        <div class="row-actions">
          <button
            v-if="row.depth === 0"
            class="icon-btn create"
            type="button"
            title="新增子分类"
            @click="openModal('create', row.item.id)"
          >
            <PlusOutlined class="action-icon" />
          </button>
          <button class="icon-btn edit" type="button" title="编辑分类" @click="openModal('edit', row.item.id)">
            <EditOutlined class="action-icon" />
          </button>
          <button class="icon-btn danger" type="button" title="删除分类" @click="handleDelete(row.item.id)">
            <DeleteOutlined class="action-icon" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="modal.visible" class="modal" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-head">
          <h3>
            {{
              modal.action === 'create_parent'
                ? '新建父分类'
                : modal.action === 'create'
                  ? `新建子分类（父级：${selectedCategory?.name || '-'}）`
                  : `编辑分类（${selectedCategory?.name || '-' }）`
            }}
          </h3>
          <span class="close" @click="closeModal">&times;</span>
        </div>
        <form id="modal-form" @submit="handleModalSubmit">
          <input type="hidden" name="category_id" :value="modal.categoryId || ''" />
          <input type="hidden" name="action" :value="modal.action" />
          <div class="form-group">
            <label for="name">分类名称</label>
            <input id="name" v-model="modal.name" type="text" class="form-control" required />
          </div>
          <div class="form-group">
            <label>分类图标</label>
            <a-upload
              :file-list="iconUploadList"
              :before-upload="handleIconBeforeUpload"
              :max-count="1"
              accept="image/*"
              @remove="handleIconRemove"
            >
              <a-button>
                <UploadOutlined />
                选择图片
              </a-button>
            </a-upload>
          </div>
          <button type="submit" class="btn btn-primary">保存</button>
        </form>
      </div>
    </div>
  </section>
</template>

<style scoped>
.category-tree-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-head {
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.head-title h2 {
  margin: 0;
  color: var(--text);
  font-size: 1.2rem;
}

.head-title p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.84rem;
}

.tree-card {
  overflow: hidden;
  padding: 0;
}

.tree-row {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}

.tree-row:last-child {
  border-bottom: none;
}

.tree-left {
  min-width: 0;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.category-name {
  color: var(--text);
  font-size: 0.94rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.child-prefix-icon {
  font-size: 0.72rem;
  color: color-mix(in srgb, var(--muted) 82%, var(--text) 18%);
}

.toggle-btn {
  width: 24px;
  height: 24px;
  border: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.toggle-btn:hover {
  background: color-mix(in srgb, var(--surface-2) 75%, transparent);
  color: var(--text);
}

.toggle-arrow {
  font-size: 0.96rem;
}

.toggle-arrow.expanded {
  transform: none;
}

.toggle-placeholder {
  width: 24px;
  height: 24px;
}

.row-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-right: 12px;
}

.icon-btn {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--surface);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.icon-btn:hover {
  background: color-mix(in srgb, var(--surface-2) 75%, transparent);
}

.icon-btn.create {
  color: var(--primary);
}

.icon-btn.edit {
  color: color-mix(in srgb, var(--text) 76%, var(--primary) 24%);
}

.icon-btn.danger {
  border-color: color-mix(in srgb, #e03131 45%, var(--border));
  color: var(--btn-danger);
}

.icon-btn:hover .action-icon {
  transform: scale(1.05);
}

.category-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.action-icon {
  font-size: 14px;
  transition: transform 0.15s ease;
}

.create-parent-btn .action-icon {
  color: var(--btn-text-on-primary);
}

.empty-tip {
  padding: 20px 16px;
  color: var(--muted);
  font-size: 0.9rem;
}

.modal {
  display: block;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: var(--overlay-backdrop);
}

.modal-content {
  background-color: var(--surface);
  margin: 10% auto;
  padding: 20px;
  border: 1px solid var(--border);
  width: min(92vw, 42rem);
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.modal-head h3 {
  margin: 0;
  color: var(--text);
  font-size: 1.02rem;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 0.86rem;
}

.form-control {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  border-radius: 6px;
  padding: 8px 10px;
}

.close {
  color: var(--muted);
  font-size: 28px;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
}

.close:hover,
.close:focus {
  color: var(--text);
}

.btn {
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: var(--primary);
  color: var(--btn-text-on-primary);
}

@media (max-width: 720px) {
  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .row-actions {
    padding-right: 8px;
  }
}
</style>

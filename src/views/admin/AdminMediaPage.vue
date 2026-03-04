<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { UploadProps } from 'ant-design-vue'
import { UploadOutlined } from '@ant-design/icons-vue'

import { useFeedback } from '@/composables/useFeedback'
import { getAdminMediaList, renameAdminMediaFile, uploadAdminMediaFile } from '@/services/admin'
import type { AdminMediaFileItem } from '@/types/admin'

const route = useRoute()
const router = useRouter()
const feedback = useFeedback()

const loading = ref(false)
const directories = ref<string[]>([])
const files = ref<AdminMediaFileItem[]>([])
const selectedUploadFile = ref<File | null>(null)
const uploadFileList = ref<Array<{ uid: string; name: string; status: 'done' }>>([])
const uploading = ref(false)

const currentPath = computed(() => {
  const raw = route.params.pathMatch
  if (Array.isArray(raw)) return raw.length ? raw.join('/') : ''
  if (typeof raw === 'string' && raw.length) return raw
  return ''
})

const breadcrumbItems = computed(() =>
  currentPath.value
    .split('/')
    .filter(Boolean)
    .map((name, index, arr) => ({
      name,
      isLast: index === arr.length - 1,
      path: arr.slice(0, index + 1).join('/'),
    })),
)

async function loadMedia() {
  loading.value = true
  try {
    const data = await getAdminMediaList(currentPath.value)
    directories.value = data.directories
    files.value = data.files
  } catch (error) {
    feedback.error(error)
  } finally {
    loading.value = false
  }
}

function goToDirectory(name: string) {
  const nextPath = currentPath.value ? `${currentPath.value}/${name}` : name
  void router.push(`/admin/pic_management/${nextPath}/`)
}

function goToRoot() {
  void router.push('/admin/pic_management/')
}

function goToBreadcrumb(path: string) {
  void router.push(`/admin/pic_management/${path}/`)
}

const handleUploadBeforeSelect: UploadProps['beforeUpload'] = (file) => {
  const selected = file as File
  selectedUploadFile.value = selected
  uploadFileList.value = [{ uid: selected.name, name: selected.name, status: 'done' }]
  return false
}

const handleUploadRemove: UploadProps['onRemove'] = () => {
  selectedUploadFile.value = null
  uploadFileList.value = []
  return true
}

async function handleUpload() {
  const file = selectedUploadFile.value
  if (!file) {
    feedback.error('请先选择文件')
    return
  }
  uploading.value = true
  try {
    await uploadAdminMediaFile({
      path: currentPath.value,
      file,
    })
    feedback.success('文件上传成功')
    selectedUploadFile.value = null
    uploadFileList.value = []
    await loadMedia()
  } catch (error) {
    feedback.error(error)
  } finally {
    uploading.value = false
  }
}

async function handleRename(file: AdminMediaFileItem) {
  const nextName = window.prompt('请输入新的文件名', file.name)
  if (!nextName || nextName.trim() === file.name) return
  try {
    await renameAdminMediaFile({
      path: currentPath.value,
      old_name: file.name,
      new_name: nextName.trim(),
    })
    feedback.success('文件重命名成功')
    await loadMedia()
  } catch (error) {
    feedback.error(error)
  }
}

watch(
  () => currentPath.value,
  () => {
    void loadMedia()
  },
)

onMounted(() => {
  void loadMedia()
})
</script>

<template>
  <section>
    <h1>Media Library</h1>

    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><a href="#" @click.prevent="goToRoot">Home</a></li>
        <li
          v-for="item in breadcrumbItems"
          :key="item.path"
          class="breadcrumb-item"
          :class="{ active: item.isLast }"
        >
          <a v-if="!item.isLast" href="#" @click.prevent="goToBreadcrumb(item.path)">{{ item.name }}</a>
          <span v-else>{{ item.name }}</span>
        </li>
      </ol>
    </nav>

    <div class="mb-4">
      <div class="upload-bar">
        <a-upload
          :file-list="uploadFileList"
          :before-upload="handleUploadBeforeSelect"
          :max-count="1"
          @remove="handleUploadRemove"
        >
          <a-button>
            <UploadOutlined />
            选择文件
          </a-button>
        </a-upload>
        <a-button type="primary" :loading="uploading" :disabled="!selectedUploadFile" @click="handleUpload">
          {{ uploading ? '上传中' : '上传' }}
        </a-button>
      </div>
    </div>

    <div class="directory-container">
      <h2>文件夹</h2>
      <div class="directories">
        <div v-for="directory in directories" :key="directory" class="directory-item" @click="goToDirectory(directory)">
          <img src="/img/folder-icon.png" alt="Folder Icon" />
          <span>{{ directory }}</span>
        </div>
      </div>
    </div>

    <div class="file-container">
      <h2>文件与图片</h2>
      <div class="files">
        <div v-for="file in files" :key="file.name" class="file-item">
          <a :href="file.url" target="_blank" rel="noopener noreferrer">
            <img src="/img/file-icon.png" alt="File Icon" />
            <span>{{ file.name }}</span>
          </a>
          <button class="btn btn-sm btn-primary" @click="handleRename(file)">Rename</button>
        </div>
      </div>
      <p v-if="!loading && !directories.length && !files.length" class="empty-tip">当前目录为空</p>
    </div>
  </section>
</template>

<style scoped>
.directory-container,
.file-container {
  margin-bottom: 20px;
}

.directory-container h2,
.file-container h2 {
  margin: 0 0 8px;
}

.breadcrumb {
  display: flex;
  list-style: none;
  padding: 0;
  margin: 0 0 14px;
}

.breadcrumb-item {
  margin-right: 8px;
}

.breadcrumb-item + .breadcrumb-item::before {
  content: '/';
  margin-right: 8px;
  color: var(--muted);
}

.upload-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.directories,
.files {
  display: flex;
  flex-wrap: wrap;
}

.directory-item,
.file-item {
  width: clamp(6.8rem, 11vw, 9.6rem);
  min-height: clamp(6.8rem, 11vw, 9.6rem);
  margin: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.directory-item:hover,
.file-item:hover {
  transform: scale(1.05);
  box-shadow: var(--tile-hover-shadow);
}

.directory-item img,
.file-item img {
  width: clamp(2rem, 4vw, 3rem);
  height: clamp(2rem, 4vw, 3rem);
  margin-bottom: 10px;
}

.directory-item span,
.file-item span {
  display: block;
  font-size: 14px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-item button {
  margin-top: 5px;
  font-size: 12px;
  padding: 5px 10px;
}

.btn {
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary {
  background: var(--primary);
  color: var(--btn-text-on-primary);
}

.btn-sm {
  padding: 5px 8px;
}

.empty-tip {
  color: var(--muted);
}
</style>

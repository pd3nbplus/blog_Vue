<script setup lang="ts">
import {
  AppstoreOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  ColumnWidthOutlined,
  FileImageOutlined,
  FileOutlined,
  FolderFilled,
  LoadingOutlined,
  PictureOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue'
import type { UploadProps } from 'ant-design-vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppImage from '@/components/common/AppImage.vue'
import { useFeedback } from '@/composables/useFeedback'
import { getAdminMediaList, renameAdminMediaFile, uploadAdminMediaFile } from '@/services/api/admin'
import type { AdminMediaFileItem, AdminMediaListResult } from '@/types/admin'

type ViewMode = 'icon' | 'list' | 'column' | 'gallery'
const MEDIA_VIEW_MODE_STORAGE_KEY = 'admin-media:view-mode'
const MEDIA_UPLOAD_MAX_BYTES = 5 * 1024 * 1024

interface ExplorerDirectoryEntry {
  kind: 'directory'
  name: string
  path: string
}

interface ExplorerFileEntry extends AdminMediaFileItem {
  kind: 'file'
  path: string
}

type ExplorerEntry = ExplorerDirectoryEntry | ExplorerFileEntry

interface DirectoryTreeRow {
  path: string
  name: string
  depth: number
  expanded: boolean
  hasChildren: boolean
  loaded: boolean
  loadingChildren: boolean
  isCurrent: boolean
}

interface PendingUploadFile {
  uid: string
  file: File
}

const route = useRoute()
const router = useRouter()
const feedback = useFeedback()
const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' })

const loading = ref(false)
const treeLoading = ref(true)
const uploading = ref(false)

const pendingUploadFiles = ref<PendingUploadFile[]>([])
const uploadFileList = computed(() =>
  pendingUploadFiles.value.map((item) => ({ uid: item.uid, name: item.file.name, status: 'done' as const })),
)

const directoryCache = ref<Record<string, AdminMediaListResult>>({})
const currentListing = ref<AdminMediaListResult>({ current_path: '', directories: [], files: [] })

const treeChildrenMap = ref<Record<string, string[]>>({})
const loadedTreeParents = ref<Set<string>>(new Set())
const treePendingPaths = ref<Set<string>>(new Set())
const expandedTreePaths = ref<Set<string>>(new Set(['']))

const selectedFilePath = ref('')
const viewMode = ref<ViewMode>(loadSavedViewMode())

const currentPath = computed(() => {
  const raw = route.params.pathMatch
  if (Array.isArray(raw)) return normalizePath(raw.join('/'))
  if (typeof raw === 'string') return normalizePath(raw)
  return ''
})

const currentSegments = computed(() => pathToSegments(currentPath.value))

const breadcrumbItems = computed(() =>
  currentSegments.value.map((name, index, segments) => ({
    name,
    isLast: index === segments.length - 1,
    path: segments.slice(0, index + 1).join('/'),
  })),
)

const currentPathLabel = computed(() => (currentPath.value ? `/static/${currentPath.value}` : '/static'))

const currentEntries = computed<ExplorerEntry[]>(() => buildEntries(currentListing.value))

const currentDirectoryEntries = computed(() =>
  currentEntries.value.filter((entry): entry is ExplorerDirectoryEntry => entry.kind === 'directory'),
)

const galleryImageEntries = computed(() =>
  currentEntries.value.filter((entry): entry is ExplorerFileEntry => entry.kind === 'file' && entry.is_image),
)

const galleryOtherFileEntries = computed(() =>
  currentEntries.value.filter((entry): entry is ExplorerFileEntry => entry.kind === 'file' && !entry.is_image),
)

const columnPathChain = computed(() => buildPathChain(currentPath.value))

const treeRows = computed<DirectoryTreeRow[]>(() => {
  const rows: DirectoryTreeRow[] = []
  const walk = (parentPath: string, depth: number) => {
    const children = treeChildrenMap.value[parentPath] ?? []
    for (const childPath of children) {
      const loaded = loadedTreeParents.value.has(childPath)
      const hasChildren = loaded ? (treeChildrenMap.value[childPath]?.length ?? 0) > 0 : true
      const expanded = expandedTreePaths.value.has(childPath)
      const loadingChildren = treePendingPaths.value.has(childPath)
      const isCurrent =
        currentPath.value === childPath ||
        (currentPath.value.length > childPath.length && currentPath.value.startsWith(`${childPath}/`))

      rows.push({
        path: childPath,
        name: getPathName(childPath),
        depth,
        expanded,
        hasChildren,
        loaded,
        loadingChildren,
        isCurrent,
      })

      if (expanded && hasChildren) {
        walk(childPath, depth + 1)
      }
    }
  }

  walk('', 0)
  return rows
})

const fileIndex = computed(() => {
  const index = new Map<string, ExplorerFileEntry>()

  for (const listing of Object.values(directoryCache.value)) {
    for (const file of listing.files) {
      const path = joinPath(listing.current_path, file.name)
      index.set(path, { ...file, kind: 'file', path })
    }
  }

  return index
})

const selectedPreviewFile = computed(() => fileIndex.value.get(selectedFilePath.value) ?? null)

let mediaLoadToken = 0

function isViewMode(value: string): value is ViewMode {
  return value === 'icon' || value === 'list' || value === 'column' || value === 'gallery'
}

function loadSavedViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'icon'
  try {
    const saved = window.localStorage.getItem(MEDIA_VIEW_MODE_STORAGE_KEY)
    if (saved && isViewMode(saved)) return saved
  } catch {
    return 'icon'
  }
  return 'icon'
}

function setViewMode(mode: ViewMode) {
  viewMode.value = mode
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function buildUploadUid(file: File & { uid?: string }): string {
  const rawUid = typeof file.uid === 'string' ? file.uid : ''
  if (rawUid) return rawUid
  return `${file.name}-${file.size}-${file.lastModified}`
}

function pathToSegments(path: string): string[] {
  return normalizePath(path)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function joinPath(parent: string, child: string): string {
  const normalizedParent = normalizePath(parent)
  const normalizedChild = normalizePath(child)
  if (!normalizedParent) return normalizedChild
  if (!normalizedChild) return normalizedParent
  return `${normalizedParent}/${normalizedChild}`
}

function getPathName(path: string): string {
  const segments = pathToSegments(path)
  return segments[segments.length - 1] || 'static'
}

function buildPathChain(path: string): string[] {
  const segments = pathToSegments(path)
  const chain = ['']
  for (let index = 0; index < segments.length; index += 1) {
    chain.push(segments.slice(0, index + 1).join('/'))
  }
  return chain
}

function buildEntries(listing: AdminMediaListResult): ExplorerEntry[] {
  const directories = listing.directories
    .map<ExplorerDirectoryEntry>((name) => ({
      kind: 'directory',
      name,
      path: joinPath(listing.current_path, name),
    }))
    .sort((a, b) => collator.compare(a.name, b.name))

  const files = listing.files
    .map<ExplorerFileEntry>((file) => ({
      ...file,
      kind: 'file',
      path: joinPath(listing.current_path, file.name),
    }))
    .sort((a, b) => collator.compare(a.name, b.name))

  return [...directories, ...files]
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let next = size
  let unitIndex = 0
  while (next >= 1024 && unitIndex < units.length - 1) {
    next /= 1024
    unitIndex += 1
  }
  return `${next.toFixed(next >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function navigateToPath(path: string) {
  const normalized = normalizePath(path)
  if (!normalized) {
    void router.push({ name: 'admin-media-root' })
    return
  }
  void router.push({ name: 'admin-media', params: { pathMatch: normalized.split('/') } })
}

function goToRoot() {
  navigateToPath('')
}

function goToBreadcrumb(path: string) {
  navigateToPath(path)
}

function goToDirectory(path: string) {
  navigateToPath(path)
}

function selectFile(path: string) {
  selectedFilePath.value = path
}

function getParentPath(path: string): string {
  const segments = pathToSegments(path)
  if (segments.length <= 1) return ''
  return segments.slice(0, -1).join('/')
}

function setTreePathPending(path: string, pending: boolean) {
  const next = new Set(treePendingPaths.value)
  if (pending) {
    next.add(path)
  } else {
    next.delete(path)
  }
  treePendingPaths.value = next
}

async function toggleTreeExpand(path: string) {
  const normalized = normalizePath(path)
  const loaded = loadedTreeParents.value.has(normalized)
  const loadedChildCount = treeChildrenMap.value[normalized]?.length ?? 0
  if (loaded && loadedChildCount === 0) return

  const next = new Set(expandedTreePaths.value)
  if (next.has(normalized)) {
    next.delete(normalized)
    expandedTreePaths.value = next
    return
  }

  next.add(normalized)
  expandedTreePaths.value = next
  await loadTreeChildren(normalized)

  if ((treeChildrenMap.value[normalized]?.length ?? 0) === 0) {
    const collapsed = new Set(expandedTreePaths.value)
    collapsed.delete(normalized)
    expandedTreePaths.value = collapsed
  }
}

function ensureTreeExpanded(path: string) {
  const next = new Set(expandedTreePaths.value)
  next.add('')
  for (const item of buildPathChain(path)) {
    if (item) next.add(item)
  }
  expandedTreePaths.value = next
}

async function fetchDirectory(path: string, force = false): Promise<AdminMediaListResult> {
  const normalized = normalizePath(path)
  const cached = directoryCache.value[normalized]
  if (cached && !force) return cached

  const data = await getAdminMediaList(normalized)
  directoryCache.value = {
    ...directoryCache.value,
    [normalized]: data,
  }
  return data
}

async function ensurePathChainCached(path: string) {
  const missing = buildPathChain(path).filter((item) => !directoryCache.value[item])
  if (!missing.length) return
  await Promise.all(missing.map((item) => fetchDirectory(item)))
}

function clearDirectoryCache() {
  directoryCache.value = {}
}

async function loadTreeChildren(parentPath: string, force = false) {
  const normalized = normalizePath(parentPath)
  if (!force && loadedTreeParents.value.has(normalized)) return

  setTreePathPending(normalized, true)
  try {
    const listing = await getAdminMediaList(normalized, { includeFiles: false })
    const children = listing.directories
      .map((name) => joinPath(normalized, name))
      .sort((a, b) => collator.compare(getPathName(a), getPathName(b)))

    treeChildrenMap.value = {
      ...treeChildrenMap.value,
      [normalized]: children,
    }

    const loadedParents = new Set(loadedTreeParents.value)
    loadedParents.add(normalized)
    loadedTreeParents.value = loadedParents
  } catch (error) {
    feedback.error(error)
  } finally {
    setTreePathPending(normalized, false)
    if (normalized === '') treeLoading.value = false
  }
}

async function ensureTreePathLoaded(path: string, force = false) {
  const chain = buildPathChain(path)
  for (const parentPath of chain) {
    await loadTreeChildren(parentPath, force)
  }
}

function clearTreeState() {
  treeLoading.value = true
  treeChildrenMap.value = {}
  loadedTreeParents.value = new Set()
  treePendingPaths.value = new Set()
  expandedTreePaths.value = new Set([''])
}

async function loadMedia(force = false) {
  const loadToken = ++mediaLoadToken
  loading.value = true

  try {
    const data = await fetchDirectory(currentPath.value, force)
    if (loadToken !== mediaLoadToken) return

    currentListing.value = data
    ensureTreeExpanded(currentPath.value)
    await ensureTreePathLoaded(currentPath.value, force)
    if (viewMode.value === 'column') {
      await ensurePathChainCached(currentPath.value)
    }
  } catch (error) {
    if (loadToken === mediaLoadToken) {
      feedback.error(error)
    }
  } finally {
    if (loadToken === mediaLoadToken) {
      loading.value = false
    }
  }
}

async function refreshExplorer() {
  clearDirectoryCache()
  clearTreeState()
  await loadMedia(true)
}

function getEntriesForPath(path: string): ExplorerEntry[] {
  const listing = directoryCache.value[path]
  if (!listing) return []
  return buildEntries(listing)
}

function isColumnEntryActive(entry: ExplorerEntry): boolean {
  if (entry.kind === 'directory') {
    return currentPath.value === entry.path || currentPath.value.startsWith(`${entry.path}/`)
  }
  return selectedFilePath.value === entry.path
}

const handleUploadBeforeSelect: UploadProps['beforeUpload'] = (file) => {
  const selected = file as File & { uid?: string }
  if (selected.size > MEDIA_UPLOAD_MAX_BYTES) {
    feedback.error(null, `文件 ${selected.name} 超过 5MB，已跳过`)
    return false
  }

  const uid = buildUploadUid(selected)
  if (pendingUploadFiles.value.some((item) => item.uid === uid)) return false

  pendingUploadFiles.value = [...pendingUploadFiles.value, { uid, file: selected }]
  return false
}

const handleUploadRemove: UploadProps['onRemove'] = (file) => {
  const removed = file as { uid?: string; name?: string }
  if (removed.uid) {
    pendingUploadFiles.value = pendingUploadFiles.value.filter((item) => item.uid !== removed.uid)
    return true
  }

  if (removed.name) {
    const index = pendingUploadFiles.value.findIndex((item) => item.file.name === removed.name)
    if (index >= 0) {
      const cloned = [...pendingUploadFiles.value]
      cloned.splice(index, 1)
      pendingUploadFiles.value = cloned
    }
  }
  return true
}

async function handleUpload() {
  if (!pendingUploadFiles.value.length) {
    feedback.error(null, '请先选择文件')
    return
  }

  const currentBatch = [...pendingUploadFiles.value]
  const failedUploads: PendingUploadFile[] = []
  let successCount = 0
  let lastUploadedPath = ''

  uploading.value = true
  try {
    for (const pending of currentBatch) {
      try {
        const result = await uploadAdminMediaFile({ path: currentPath.value, file: pending.file })
        successCount += 1
        lastUploadedPath = joinPath(result.path, result.name)
      } catch {
        failedUploads.push(pending)
      }
    }

    pendingUploadFiles.value = failedUploads
    if (lastUploadedPath) {
      selectedFilePath.value = lastUploadedPath
    }

    if (successCount > 0) {
      feedback.success(`成功上传 ${successCount} 个文件`)
      await refreshExplorer()
    }

    if (failedUploads.length > 0) {
      feedback.error(null, `${failedUploads.length} 个文件上传失败（已保留在待上传列表）`)
    }
  } catch (error) {
    feedback.error(error)
  } finally {
    uploading.value = false
  }
}

async function handleRename(file: ExplorerFileEntry, directoryPath = currentPath.value) {
  const nextName = window.prompt('请输入新的文件名', file.name)
  const normalized = (nextName || '').trim()
  if (!normalized || normalized === file.name) return

  try {
    await renameAdminMediaFile({
      path: directoryPath,
      old_name: file.name,
      new_name: normalized,
    })
    selectedFilePath.value = joinPath(directoryPath, normalized)
    feedback.success('文件重命名成功')
    await refreshExplorer()
  } catch (error) {
    feedback.error(error)
  }
}

watch(
  () => viewMode.value,
  (mode) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(MEDIA_VIEW_MODE_STORAGE_KEY, mode)
    } catch {
      // ignore storage failure
    }
    if (mode === 'column') {
      void ensurePathChainCached(currentPath.value)
    }
  },
  { immediate: true },
)

watch(
  () => currentPath.value,
  () => {
    selectedFilePath.value = ''
    void loadMedia()
  },
  { immediate: true },
)
</script>

<template>
  <section class="media-page">
    <header class="media-header app-surface-card">
      <div class="media-header-main">
        <div>
          <h1>媒体库</h1>
          <p>Finder 风格文件管理器，浏览整个 <code>/static</code> 目录</p>
        </div>
        <div class="media-header-actions">
          <a-upload
            :file-list="uploadFileList"
            :before-upload="handleUploadBeforeSelect"
            multiple
            @remove="handleUploadRemove"
          >
            <a-button>
              <UploadOutlined />
              选择文件（可多选）
            </a-button>
          </a-upload>
          <a-button type="primary" :loading="uploading" :disabled="!pendingUploadFiles.length" @click="handleUpload">
            {{ uploading ? '上传中' : `上传（${pendingUploadFiles.length}）` }}
          </a-button>
          <span class="upload-hint">单个文件不超过 5MB</span>
          <a-button :loading="loading || treeLoading" @click="refreshExplorer">
            <ReloadOutlined />
            刷新
          </a-button>
        </div>
      </div>

      <nav aria-label="breadcrumb" class="breadcrumb-wrapper">
        <ol class="breadcrumb">
          <li class="breadcrumb-item">
            <a href="#" @click.prevent="goToRoot">static</a>
          </li>
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
    </header>

    <div class="manager-shell app-surface-card">
      <aside class="tree-panel">
        <button class="tree-root" :class="{ active: currentPath === '' }" @click="goToRoot">
          <FolderFilled />
          <span>static</span>
        </button>

        <div class="tree-list" v-if="treeRows.length">
          <button
            v-for="row in treeRows"
            :key="row.path"
            class="tree-row"
            :class="{ active: row.isCurrent }"
            :style="{ '--depth': row.depth }"
            @click="goToDirectory(row.path)"
          >
            <span class="tree-toggle" @click.stop="row.hasChildren && toggleTreeExpand(row.path)">
              <LoadingOutlined v-if="row.loadingChildren" />
              <CaretDownOutlined v-else-if="row.hasChildren && row.expanded" />
              <CaretRightOutlined v-else-if="row.hasChildren" />
            </span>
            <FolderFilled />
            <span class="tree-name">{{ row.name }}</span>
          </button>
        </div>

        <a-empty v-else-if="!treeLoading" description="暂无目录" :image="false" />
        <a-spin v-else />
      </aside>

      <section class="content-panel">
        <div class="content-toolbar">
          <p class="current-path">当前路径: {{ currentPathLabel }}</p>
          <div class="view-switcher">
            <button :class="{ active: viewMode === 'icon' }" @click="setViewMode('icon')">
              <AppstoreOutlined />
              图标
            </button>
            <button :class="{ active: viewMode === 'list' }" @click="setViewMode('list')">
              <UnorderedListOutlined />
              列表
            </button>
            <button :class="{ active: viewMode === 'column' }" @click="setViewMode('column')">
              <ColumnWidthOutlined />
              分栏
            </button>
            <button :class="{ active: viewMode === 'gallery' }" @click="setViewMode('gallery')">
              <PictureOutlined />
              画廊
            </button>
          </div>
        </div>

        <div class="content-body">
          <div v-if="viewMode === 'icon'" class="icon-grid">
            <article
              v-for="entry in currentEntries"
              :key="entry.path"
              class="entry-card"
              :class="{ file: entry.kind === 'file', image: entry.kind === 'file' && entry.is_image }"
            >
              <button
                v-if="entry.kind === 'directory'"
                class="entry-main"
                type="button"
                @click="goToDirectory(entry.path)"
              >
                <div class="entry-icon"><FolderFilled /></div>
                <p class="entry-name">{{ entry.name }}</p>
              </button>

              <template v-else>
                <button class="entry-main" type="button" @click="selectFile(entry.path)">
                  <AppImage
                    v-if="entry.is_image"
                    :src="entry.url"
                    :alt="entry.name"
                    fallback-src="/img/file-icon.png"
                    loading="lazy"
                    class="entry-thumbnail"
                  />
                  <div v-else class="entry-icon">
                    <FileOutlined />
                  </div>
                  <p class="entry-name">{{ entry.name }}</p>
                  <p class="entry-meta">{{ formatFileSize(entry.size) }}</p>
                </button>
                <div class="entry-actions">
                  <a :href="entry.url" target="_blank" rel="noopener noreferrer">打开</a>
                  <button type="button" @click="handleRename(entry)">重命名</button>
                </div>
              </template>
            </article>

            <p v-if="!currentEntries.length" class="empty-tip">当前目录为空</p>
          </div>

          <div v-else-if="viewMode === 'list'" class="list-view">
            <table class="list-table" v-if="currentEntries.length">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>类型</th>
                  <th>大小</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in currentEntries" :key="entry.path">
                  <td>
                    <button
                      v-if="entry.kind === 'directory'"
                      class="name-btn"
                      type="button"
                      @click="goToDirectory(entry.path)"
                    >
                      <FolderFilled />
                      {{ entry.name }}
                    </button>
                    <span v-else class="name-cell" @click="selectFile(entry.path)">
                      <FileImageOutlined v-if="entry.is_image" />
                      <FileOutlined v-else />
                      {{ entry.name }}
                    </span>
                  </td>
                  <td>{{ entry.kind === 'directory' ? '文件夹' : entry.is_image ? '图片' : '文件' }}</td>
                  <td>{{ entry.kind === 'file' ? formatFileSize(entry.size) : '--' }}</td>
                  <td>{{ entry.kind === 'file' ? formatDateTime(entry.updated_at) : '--' }}</td>
                  <td>
                    <template v-if="entry.kind === 'file'">
                      <a :href="entry.url" target="_blank" rel="noopener noreferrer">打开</a>
                      <button type="button" class="inline-action" @click="handleRename(entry)">重命名</button>
                    </template>
                    <template v-else>
                      <button type="button" class="inline-action" @click="goToDirectory(entry.path)">进入</button>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else class="empty-tip">当前目录为空</p>
          </div>

          <div v-else-if="viewMode === 'column'" class="column-view">
            <div class="column-layout">
              <section v-for="path in columnPathChain" :key="path || '__root'" class="column-panel">
                <header>{{ path ? getPathName(path) : 'static' }}</header>
                <div class="column-content" v-if="directoryCache[path]">
                  <button
                    v-for="entry in getEntriesForPath(path)"
                    :key="entry.path"
                    class="column-entry"
                    :class="{ active: isColumnEntryActive(entry) }"
                    type="button"
                    @click="entry.kind === 'directory' ? goToDirectory(entry.path) : selectFile(entry.path)"
                  >
                    <FolderFilled v-if="entry.kind === 'directory'" />
                    <FileImageOutlined v-else-if="entry.is_image" />
                    <FileOutlined v-else />
                    <span>{{ entry.name }}</span>
                    <CaretRightOutlined v-if="entry.kind === 'directory'" class="column-arrow" />
                  </button>
                </div>
                <a-empty v-else description="加载中" :image="false" />
              </section>

              <aside class="preview-panel">
                <h3>预览</h3>
                <template v-if="selectedPreviewFile">
                  <AppImage
                    v-if="selectedPreviewFile.is_image"
                    :src="selectedPreviewFile.url"
                    :alt="selectedPreviewFile.name"
                    fallback-src="/img/file-icon.png"
                    loading="eager"
                    class="preview-image"
                  />
                  <div v-else class="preview-file-icon">
                    <FileOutlined />
                  </div>
                  <p class="preview-name">{{ selectedPreviewFile.name }}</p>
                  <p class="preview-meta">{{ formatFileSize(selectedPreviewFile.size) }}</p>
                  <p class="preview-meta">{{ formatDateTime(selectedPreviewFile.updated_at) }}</p>
                  <div class="preview-actions">
                    <a :href="selectedPreviewFile.url" target="_blank" rel="noopener noreferrer">打开</a>
                    <button type="button" @click="handleRename(selectedPreviewFile, getParentPath(selectedPreviewFile.path))">
                      重命名
                    </button>
                  </div>
                </template>
                <p v-else class="empty-tip">在分栏视图中选择文件可预览</p>
              </aside>
            </div>
          </div>

          <div v-else class="gallery-view">
            <section v-if="currentDirectoryEntries.length" class="gallery-folders">
              <h3>文件夹</h3>
              <div class="gallery-folder-grid">
                <button
                  v-for="directory in currentDirectoryEntries"
                  :key="directory.path"
                  type="button"
                  class="gallery-folder"
                  @click="goToDirectory(directory.path)"
                >
                  <FolderFilled />
                  <span>{{ directory.name }}</span>
                </button>
              </div>
            </section>

            <section>
              <h3>图片画廊</h3>
              <div v-if="galleryImageEntries.length" class="gallery-grid">
                <article v-for="image in galleryImageEntries" :key="image.path" class="gallery-card">
                  <AppImage
                    :src="image.url"
                    :alt="image.name"
                    fallback-src="/img/file-icon.png"
                    loading="lazy"
                    class="gallery-image"
                  />
                  <div class="gallery-meta">
                    <p class="gallery-name">{{ image.name }}</p>
                    <p>{{ formatFileSize(image.size) }}</p>
                    <div class="gallery-actions">
                      <a :href="image.url" target="_blank" rel="noopener noreferrer">打开</a>
                      <button type="button" @click="handleRename(image)">重命名</button>
                    </div>
                  </div>
                </article>
              </div>
              <p v-else class="empty-tip">当前目录没有图片文件</p>
            </section>

            <section v-if="galleryOtherFileEntries.length">
              <h3>其他文件</h3>
              <ul class="gallery-other-files">
                <li v-for="file in galleryOtherFileEntries" :key="file.path">
                  <span>
                    <FileOutlined />
                    {{ file.name }}
                  </span>
                  <span>{{ formatFileSize(file.size) }}</span>
                  <span>{{ formatDateTime(file.updated_at) }}</span>
                  <span>
                    <a :href="file.url" target="_blank" rel="noopener noreferrer">打开</a>
                    <button type="button" @click="handleRename(file)">重命名</button>
                  </span>
                </li>
              </ul>
            </section>

            <p v-if="!currentEntries.length" class="empty-tip">当前目录为空</p>
          </div>

          <div v-if="loading" class="content-loading-overlay">
            <a-spin />
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
@import '@/styles/pages/admin-media-page.css';
</style>

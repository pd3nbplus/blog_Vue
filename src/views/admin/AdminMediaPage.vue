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
import { getAdminMediaList, renameAdminMediaFile, uploadAdminMediaFile } from '@/services/admin'
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
.media-page {
  display: grid;
  gap: 14px;
}

.media-header {
  padding: 16px;
}

.media-header-main {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.media-header h1 {
  margin: 0;
  font-size: clamp(1.2rem, 1.7vw, 1.5rem);
}

.media-header p {
  margin: 6px 0 0;
  color: var(--muted);
}

.media-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.upload-hint {
  font-size: 0.82rem;
  color: var(--muted);
}

.breadcrumb-wrapper {
  margin-top: 12px;
}

.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  list-style: none;
  gap: 8px;
  margin: 0;
  padding: 0;
}

.breadcrumb-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.breadcrumb-item + .breadcrumb-item::before {
  content: '/';
  color: var(--muted);
}

.breadcrumb-item a {
  text-decoration: none;
}

.breadcrumb-item.active span {
  color: var(--muted);
}

.manager-shell {
  min-height: min(70vh, 880px);
  display: grid;
  grid-template-columns: minmax(220px, 270px) minmax(0, 1fr);
  overflow: hidden;
}

.tree-panel {
  border-right: 1px solid var(--border);
  padding: 12px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tree-root,
.tree-row {
  border: none;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  cursor: pointer;
  border-radius: 8px;
}

.tree-root {
  padding: 8px;
  font-weight: 700;
}

.tree-root.active,
.tree-row.active {
  background: color-mix(in srgb, var(--primary) 12%, var(--surface));
  color: var(--primary);
}

.tree-list {
  display: grid;
  gap: 2px;
}

.tree-row {
  padding: 6px 8px;
  padding-left: calc(8px + var(--depth, 0) * 16px);
}

.tree-toggle {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
}

.tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.content-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.current-path {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
}

.view-switcher {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
}

.view-switcher button {
  border: none;
  background: transparent;
  padding: 7px 12px;
  cursor: pointer;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.view-switcher button.active {
  background: var(--surface);
  color: var(--primary);
}

.content-body {
  position: relative;
  min-height: 380px;
  padding: 14px;
  overflow: auto;
}

.content-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 12;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  backdrop-filter: blur(1px);
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
  gap: 12px;
  content-visibility: auto;
  contain-intrinsic-size: 560px;
}

.entry-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 170px;
}

.entry-main {
  border: none;
  background: transparent;
  width: 100%;
  cursor: pointer;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.entry-icon {
  font-size: 40px;
  color: var(--primary);
  line-height: 1;
}

.entry-thumbnail {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.entry-name {
  margin: 0;
  text-align: center;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-meta {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.entry-actions {
  margin-top: auto;
  border-top: 1px solid var(--border);
  display: flex;
}

.entry-actions a,
.entry-actions button {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px;
  cursor: pointer;
  color: var(--primary);
  text-decoration: none;
  text-align: center;
}

.entry-actions button {
  border-left: 1px solid var(--border);
}

.list-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}

.list-table th,
.list-table td {
  border-bottom: 1px solid var(--border);
  padding: 10px;
  text-align: left;
}

.name-btn,
.name-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.name-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
  padding: 0;
}

.name-cell {
  cursor: pointer;
}

.inline-action {
  border: none;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  margin-left: 10px;
}

.column-layout {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(210px, 240px);
  gap: 10px;
  align-items: stretch;
}

.column-panel,
.preview-panel {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  min-height: 420px;
  display: flex;
  flex-direction: column;
}

.column-panel header,
.preview-panel h3 {
  margin: 0;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 0.92rem;
}

.column-content {
  padding: 6px;
  display: grid;
  gap: 2px;
}

.column-entry {
  border: none;
  background: transparent;
  border-radius: 8px;
  padding: 7px 8px;
  cursor: pointer;
  text-align: left;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.column-entry .column-arrow {
  margin-left: auto;
  color: var(--muted);
}

.column-entry.active {
  background: color-mix(in srgb, var(--primary) 14%, var(--surface));
  color: var(--primary);
}

.preview-panel {
  width: clamp(240px, 24vw, 300px);
  padding-bottom: 10px;
}

.preview-image {
  display: block;
  width: calc(100% - 24px);
  margin: 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  object-fit: contain;
  max-height: 220px;
}

.preview-file-icon {
  font-size: 56px;
  color: var(--primary);
  text-align: center;
  padding: 20px 0 6px;
}

.preview-name,
.preview-meta {
  margin: 0;
  padding: 0 12px;
}

.preview-name {
  font-weight: 700;
  margin-bottom: 8px;
}

.preview-meta {
  color: var(--muted);
  font-size: 0.86rem;
  margin-bottom: 4px;
}

.preview-actions {
  display: flex;
  gap: 10px;
  padding: 10px 12px 0;
}

.preview-actions a,
.preview-actions button {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text);
  text-decoration: none;
  padding: 6px 10px;
  cursor: pointer;
}

.gallery-view {
  display: grid;
  gap: 16px;
}

.gallery-view h3 {
  margin: 0 0 8px;
}

.gallery-folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.gallery-folder {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  content-visibility: auto;
  contain-intrinsic-size: 600px;
}

.gallery-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
}

.gallery-image {
  display: block;
  width: 100%;
  height: 180px;
  object-fit: cover;
}

.gallery-meta {
  padding: 10px;
  display: grid;
  gap: 4px;
}

.gallery-meta p {
  margin: 0;
}

.gallery-name {
  font-weight: 700;
}

.gallery-actions {
  margin-top: 6px;
  display: flex;
  gap: 8px;
}

.gallery-actions a,
.gallery-actions button {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text);
  padding: 6px 8px;
  text-decoration: none;
  cursor: pointer;
}

.gallery-other-files {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.gallery-other-files li {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 100px 180px auto;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.gallery-other-files li:last-child {
  border-bottom: none;
}

.gallery-other-files span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gallery-other-files button {
  border: none;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
}

.empty-tip {
  color: var(--muted);
}

@media (max-width: 1100px) {
  .manager-shell {
    grid-template-columns: 1fr;
  }

  .tree-panel {
    border-right: none;
    border-bottom: 1px solid var(--border);
    max-height: 240px;
  }

  .column-layout {
    grid-auto-columns: minmax(190px, 220px);
    overflow-x: auto;
    padding-bottom: 6px;
  }

  .gallery-other-files li {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}

@media (max-width: 720px) {
  .view-switcher button {
    padding: 7px 8px;
    font-size: 0.82rem;
  }

  .list-table {
    font-size: 0.84rem;
  }

  .list-table th,
  .list-table td {
    padding: 8px;
  }
}
</style>

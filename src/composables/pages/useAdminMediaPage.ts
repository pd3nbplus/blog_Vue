import { computed, ref, watch } from 'vue'
import type { UploadProps } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'
import { useFeedback } from '@/composables/useFeedback'
import {
  MEDIA_UPLOAD_MAX_BYTES,
  MEDIA_VIEW_MODE_STORAGE_KEY,
  buildPathChain,
  buildUploadUid,
  formatDateTime,
  formatFileSize,
  getPathName,
  joinPath,
  loadSavedViewMode,
  normalizePath,
  pathToSegments,
  type DirectoryTreeRow,
  type ExplorerDirectoryEntry,
  type ExplorerEntry,
  type ExplorerFileEntry,
  type PendingUploadFile,
  type ViewMode,
} from '@/composables/pages/adminMediaPage.shared'
import { getAdminMediaList, renameAdminMediaFile, uploadAdminMediaFile } from '@/services/api/admin'
import type { AdminMediaListResult } from '@/types/admin'
// Keep inferred return object types for composable consumers without duplicating an oversized interface.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useAdminMediaPage() {
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

    const walk = (parentPath: string, depth: number): void => {
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

  function setViewMode(mode: ViewMode): void {
    viewMode.value = mode
  }

  function navigateToPath(path: string): void {
    const normalized = normalizePath(path)
    if (!normalized) {
      void router.push({ name: 'admin-media-root' })
      return
    }
    void router.push({ name: 'admin-media', params: { pathMatch: normalized.split('/') } })
  }

  function goToRoot(): void {
    navigateToPath('')
  }

  function goToBreadcrumb(path: string): void {
    navigateToPath(path)
  }

  function goToDirectory(path: string): void {
    navigateToPath(path)
  }

  function selectFile(path: string): void {
    selectedFilePath.value = path
  }

  function getParentPath(path: string): string {
    const segments = pathToSegments(path)
    if (segments.length <= 1) return ''
    return segments.slice(0, -1).join('/')
  }

  function setTreePathPending(path: string, pending: boolean): void {
    const next = new Set(treePendingPaths.value)
    if (pending) {
      next.add(path)
    } else {
      next.delete(path)
    }
    treePendingPaths.value = next
  }

  async function loadTreeChildren(parentPath: string, force = false): Promise<void> {
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

  async function toggleTreeExpand(path: string): Promise<void> {
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

  function ensureTreeExpanded(path: string): void {
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

  async function ensurePathChainCached(path: string): Promise<void> {
    const missing = buildPathChain(path).filter((item) => !directoryCache.value[item])
    if (!missing.length) return
    await Promise.all(missing.map((item) => fetchDirectory(item)))
  }

  function clearDirectoryCache(): void {
    directoryCache.value = {}
  }

  async function ensureTreePathLoaded(path: string, force = false): Promise<void> {
    const chain = buildPathChain(path)
    for (const parentPath of chain) {
      await loadTreeChildren(parentPath, force)
    }
  }

  function clearTreeState(): void {
    treeLoading.value = true
    treeChildrenMap.value = {}
    loadedTreeParents.value = new Set()
    treePendingPaths.value = new Set()
    expandedTreePaths.value = new Set([''])
  }

  async function loadMedia(force = false): Promise<void> {
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

  async function refreshExplorer(): Promise<void> {
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

  async function handleUpload(): Promise<void> {
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

  async function handleRename(file: ExplorerFileEntry, directoryPath = currentPath.value): Promise<void> {
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

  return {
    loading,
    treeLoading,
    uploading,
    pendingUploadFiles,
    uploadFileList,
    directoryCache,
    selectedPreviewFile,
    currentPath,
    breadcrumbItems,
    currentPathLabel,
    currentEntries,
    currentDirectoryEntries,
    galleryImageEntries,
    galleryOtherFileEntries,
    columnPathChain,
    treeRows,
    viewMode,
    setViewMode,
    formatFileSize,
    formatDateTime,
    getPathName,
    getParentPath,
    goToRoot,
    goToBreadcrumb,
    goToDirectory,
    selectFile,
    toggleTreeExpand,
    refreshExplorer,
    getEntriesForPath,
    isColumnEntryActive,
    handleUploadBeforeSelect,
    handleUploadRemove,
    handleUpload,
    handleRename,
  }
}

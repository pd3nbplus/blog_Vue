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
} from "@ant-design/icons-vue"

import AppImage from "@/components/common/AppImage.vue"
import { useAdminMediaPage } from "@/composables/pages/useAdminMediaPage"

const {
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
} = useAdminMediaPage()
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

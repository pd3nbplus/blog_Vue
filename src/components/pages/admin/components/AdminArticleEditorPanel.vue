<script setup lang="ts">
import { UploadOutlined } from '@ant-design/icons-vue'

import AppImage from '@/components/common/AppImage.vue'
import { useAdminArticleEditorPanel } from '@/composables/pages/useAdminArticleEditorPanel'
import type { AdminArticlePayload, CategoryItem } from '@/types/article'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    submitting: boolean
    categoryTree: CategoryItem[]
    initialValue?: Partial<AdminArticlePayload> | null
    editing: boolean
  }>(),
  {
    loading: false,
    initialValue: null,
  },
)

const emit = defineEmits<{
  submit: [value: AdminArticlePayload]
  cancel: []
}>()

const {
  formState,
  statusOptions,
  rules,
  formRef,
  markdownTextareaRef,
  previewScrollRef,
  previewContainerRef,
  categoryTreeData,
  categoryExpandedKeys,
  handleCategoryDropdownVisibleChange,
  handleCategoryTreeExpand,
  handleConfirm,
  handleSkipUploadAndSubmit,
  handleUploadAndSubmit,
  handlePreviewScroll,
  previewHtml,
  markdownFileUploading,
  markdownUploadList,
  handleMarkdownBeforeUpload,
  handleMarkdownRemove,
  coverUploading,
  coverUploadList,
  coverPreview,
  handleCoverBeforeUpload,
  handleCoverRemove,
  detectedLocalRefs,
  localImageDialogOpen,
  localImageSubmitting,
  pendingLocalRefs,
  selectedLocalFiles,
  localImageMatchResult,
  localImageMatchStats,
  sourceMarkdownPathMissingForUpload,
  handleLocalFilesBeforeUpload,
  handleLocalDirectoryBeforeUpload,
  clearSelectedLocalFiles,
  getPreviewStatusText,
} = useAdminArticleEditorPanel(props, (value) => {
  emit('submit', value)
})
</script>

<template>
  <section class="editor-page app-surface-card">
    <div class="editor-head">
      <div class="head-title">
        <h2>{{ editing ? '编辑文章' : '新建文章' }}</h2>
        <p>左侧编辑 Markdown 原文，右侧实时渲染预览</p>
      </div>
      <a-space>
        <a-button :disabled="submitting" @click="emit('cancel')">返回列表</a-button>
        <a-button type="primary" :loading="submitting" @click="handleConfirm">
          {{ editing ? '保存修改' : '发布文章' }}
        </a-button>
      </a-space>
    </div>

    <a-spin :spinning="loading">
      <a-form ref="formRef" :model="formState" :rules="rules" layout="vertical">
        <div class="meta-grid">
          <a-form-item label="标题" name="title">
            <a-input v-model:value="formState.title" />
          </a-form-item>
          <a-form-item label="slug" name="slug">
            <a-input v-model:value="formState.slug" />
          </a-form-item>
          <a-form-item label="状态" name="status">
            <a-select v-model:value="formState.status" :options="statusOptions" />
          </a-form-item>
          <a-form-item label="分类">
            <a-tree-select
              v-model:value="formState.category"
              allow-clear
              :tree-data="categoryTreeData"
              :tree-expanded-keys="categoryExpandedKeys"
              :show-search="false"
              tree-expand-action="click"
              placeholder="先点击一级分类，再选择二级分类"
              @dropdownVisibleChange="handleCategoryDropdownVisibleChange"
              @treeExpand="handleCategoryTreeExpand"
            />
          </a-form-item>
        </div>

        <a-form-item label="摘要">
          <a-textarea v-model:value="formState.summary" :rows="3" />
        </a-form-item>

        <div class="asset-grid">
          <a-form-item label="来源 Markdown 路径" class="asset-item">
            <a-input v-model:value="formState.source_markdown_path" placeholder="例如：深度学习/NLP/xxx.md" />
          </a-form-item>
          <a-form-item label="封面路径" class="asset-item">
            <a-input v-model:value="formState.cover_path" placeholder="可填本地路径或外链 URL">
              <template #addonAfter>
                <a-upload
                  :show-upload-list="false"
                  :file-list="coverUploadList"
                  :before-upload="handleCoverBeforeUpload"
                  :max-count="1"
                  accept="image/*"
                  @remove="handleCoverRemove"
                >
                  <a-button type="link" size="small" :loading="coverUploading">
                    <UploadOutlined />
                    上传图片
                  </a-button>
                </a-upload>
              </template>
            </a-input>
            <div v-if="coverUploadList.length" class="cover-upload-hint">
              已选择：{{ coverUploadList[0]?.name }}
            </div>
            <AppImage v-if="coverPreview" :src="coverPreview" alt="cover preview" class="cover-preview" fallback-src="/img/hero-image.jpg" />
          </a-form-item>
        </div>

        <a-form-item>
          <a-checkbox v-model:checked="formState.is_pinned">置顶文章</a-checkbox>
        </a-form-item>

        <div class="editor-columns">
          <section class="editor-column">
            <a-form-item name="markdown_content">
              <template #label>
                <div class="markdown-label-row">
                  <span>Markdown 正文</span>
                  <div class="upload-line upload-line--inline">
                    <a-upload
                      :file-list="markdownUploadList"
                      :before-upload="handleMarkdownBeforeUpload"
                      :max-count="1"
                      accept=".md,.markdown,.txt,.html,.htm"
                      @remove="handleMarkdownRemove"
                    >
                      <a-button size="small" :loading="markdownFileUploading">
                        <UploadOutlined />
                        选择 Markdown
                      </a-button>
                    </a-upload>
                  </div>
                </div>
              </template>
              <a-textarea
                ref="markdownTextareaRef"
                v-model:value="formState.markdown_content"
                class="markdown-textarea"
                :auto-size="false"
              />
              <div v-if="detectedLocalRefs.length" class="local-image-tip">
                检测到 {{ detectedLocalRefs.length }} 处本地图片引用，提交时将提示上传并自动处理引用路径。
              </div>
            </a-form-item>
          </section>

          <section class="editor-column preview-column">
            <h3 class="preview-title">实时预览</h3>
            <div ref="previewScrollRef" class="preview-scroll" @scroll.passive="handlePreviewScroll">
              <div v-if="!formState.markdown_content.trim()" class="preview-empty">在左侧输入 Markdown 后，这里会实时渲染结果。</div>
              <article v-else ref="previewContainerRef" class="preview-markdown markdown-body" v-html="previewHtml" />
            </div>
          </section>
        </div>
      </a-form>
    </a-spin>
  </section>

  <a-modal
    :open="localImageDialogOpen"
    title="检测到本地图片引用"
    :confirm-loading="localImageSubmitting"
    ok-text="上传并发布"
    cancel-text="返回编辑"
    @ok="handleUploadAndSubmit"
    @cancel="handleSkipUploadAndSubmit"
  >
    <p>检测到 {{ pendingLocalRefs.length }} 处本地图片引用。</p>
    <p>发布前必须先完成图片上传与匹配。可选择单个文件或整个图片目录，系统将优先按“相对路径”匹配，失败时再按“文件名”匹配。</p>
    <div class="upload-line">
      <a-upload :show-upload-list="false" :before-upload="handleLocalFilesBeforeUpload" multiple accept="image/*">
        <a-button size="small">
          <UploadOutlined />
          选择图片文件
        </a-button>
      </a-upload>
      <a-upload
        :show-upload-list="false"
        :before-upload="handleLocalDirectoryBeforeUpload"
        directory
        multiple
        accept="image/*"
      >
        <a-button size="small">
          <UploadOutlined />
          选择图片目录
        </a-button>
      </a-upload>
      <a-button type="link" size="small" @click="clearSelectedLocalFiles">清空已选</a-button>
    </div>
    <p class="selected-files">
      已选择 {{ selectedLocalFiles.length }} 个文件
      （已匹配 {{ localImageMatchStats.matched }}，未匹配 {{ localImageMatchStats.unmatched }}，冲突
      {{ localImageMatchStats.ambiguous }}）
    </p>
    <p v-if="sourceMarkdownPathMissingForUpload" class="mapping-warning">
      已匹配到图片，但“来源 Markdown 路径”为空，暂不可上传，请先补全该字段。
    </p>
    <div class="ref-list">
      <p>本次检测结果：</p>
      <ul>
        <li v-for="item in localImageMatchResult.previews" :key="item.ref" class="ref-item">
          <code>{{ item.ref }}</code>
          <span class="ref-status" :class="`ref-status--${item.status}`">{{ getPreviewStatusText(item.status) }}</span>
          <span v-if="item.status === 'matched'" class="ref-detail">
            {{ item.strategy === 'path' ? '路径匹配' : '文件名匹配' }} -> {{ item.matchedFileDisplay || item.matchedFileName }}
          </span>
          <span v-else-if="item.status === 'ambiguous'" class="ref-detail">
            候选：{{ item.candidateDisplays?.slice(0, 2).join('、') }}{{ (item.candidateDisplays?.length || 0) > 2 ? '…' : '' }}
          </span>
        </li>
      </ul>
    </div>
  </a-modal>
</template>

<style scoped>
@import '/css/github-markdown.min.css';
@import '/css/default.min.css';
@import 'katex/dist/katex.min.css';
@import '@/styles/pages/admin-article-editor-panel.css';
</style>

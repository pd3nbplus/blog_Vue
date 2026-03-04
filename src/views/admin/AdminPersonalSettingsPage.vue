<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { UploadProps } from 'ant-design-vue'
import { UploadOutlined } from '@ant-design/icons-vue'

import AppImage from '@/components/common/AppImage.vue'
import { useFeedback } from '@/composables/useFeedback'
import { getAdminProfile, updateAdminPassword, updateAdminProfile, uploadAdminMediaFile } from '@/services/admin'
import { resolveTempAsset } from '@/utils/assets'

const feedback = useFeedback()
const loading = ref(false)
const submitting = ref(false)
const passwordSubmitting = ref(false)

const formState = reactive({
  username: '',
  email: '',
  homeAvatarPath: '',
  homeHeroPath: '',
})
const avatarFile = ref<File | null>(null)
const heroFile = ref<File | null>(null)
const avatarUploadList = ref<Array<{ uid: string; name: string; status: 'done' }>>([])
const heroUploadList = ref<Array<{ uid: string; name: string; status: 'done' }>>([])
const avatarUploading = ref(false)
const heroUploading = ref(false)

const passwordState = reactive({
  currentPassword: '',
  nextPassword: '',
  confirmPassword: '',
})

async function loadProfile() {
  loading.value = true
  try {
    const profile = await getAdminProfile()
    formState.username = profile.username || ''
    formState.email = profile.email || ''
    formState.homeAvatarPath = profile.home_avatar_path || ''
    formState.homeHeroPath = profile.home_hero_path || ''
  } catch (error) {
    feedback.error(error)
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  submitting.value = true
  try {
    await updateAdminProfile({
      username: formState.username.trim(),
      email: formState.email.trim(),
      home_avatar_path: formState.homeAvatarPath.trim(),
      home_hero_path: formState.homeHeroPath.trim(),
    })
    feedback.success('个人资料更新成功')
  } catch (error) {
    feedback.error(error)
  } finally {
    submitting.value = false
  }
}

const handleAvatarBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  const selected = file as File
  avatarFile.value = selected
  avatarUploadList.value = [{ uid: selected.name, name: selected.name, status: 'done' }]
  return false
}

const handleAvatarRemove: UploadProps['onRemove'] = () => {
  avatarFile.value = null
  avatarUploadList.value = []
  return true
}

const handleHeroBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  const selected = file as File
  heroFile.value = selected
  heroUploadList.value = [{ uid: selected.name, name: selected.name, status: 'done' }]
  return false
}

const handleHeroRemove: UploadProps['onRemove'] = () => {
  heroFile.value = null
  heroUploadList.value = []
  return true
}

function resolveImagePath(path: string, fallback: string): string {
  return resolveTempAsset(path) || fallback
}

async function handleAvatarUpload() {
  if (!avatarFile.value) {
    feedback.error('请先选择头像图片')
    return
  }
  avatarUploading.value = true
  try {
    const result = await uploadAdminMediaFile({
      path: 'site-settings/avatar',
      file: avatarFile.value,
    })
    formState.homeAvatarPath = result.path
    avatarFile.value = null
    avatarUploadList.value = []
    feedback.success('头像上传成功')
  } catch (error) {
    feedback.error(error)
  } finally {
    avatarUploading.value = false
  }
}

async function handleHeroUpload() {
  if (!heroFile.value) {
    feedback.error('请先选择首页大图')
    return
  }
  heroUploading.value = true
  try {
    const result = await uploadAdminMediaFile({
      path: 'site-settings/hero',
      file: heroFile.value,
    })
    formState.homeHeroPath = result.path
    heroFile.value = null
    heroUploadList.value = []
    feedback.success('首页大图上传成功')
  } catch (error) {
    feedback.error(error)
  } finally {
    heroUploading.value = false
  }
}

async function handlePasswordSubmit() {
  if (!passwordState.currentPassword || !passwordState.nextPassword) {
    feedback.error('请填写当前密码和新密码')
    return
  }
  if (passwordState.nextPassword !== passwordState.confirmPassword) {
    feedback.error('两次输入的新密码不一致')
    return
  }
  passwordSubmitting.value = true
  try {
    await updateAdminPassword({
      current_password: passwordState.currentPassword,
      new_password: passwordState.nextPassword,
    })
    feedback.success('密码修改成功')
    passwordState.currentPassword = ''
    passwordState.nextPassword = ''
    passwordState.confirmPassword = ''
  } catch (error) {
    feedback.error(error)
  } finally {
    passwordSubmitting.value = false
  }
}

onMounted(() => {
  void loadProfile()
})
</script>

<template>
  <section class="settings-page">
    <div class="container mt-5">
      <h2>个人设置</h2>

      <div class="settings-card">
        <form class="settings-form" @submit.prevent="handleSubmit">
          <div class="form-row">
            <label for="username">用户名</label>
            <input id="username" v-model.trim="formState.username" type="text" class="form-control" :disabled="loading" />
          </div>
          <div class="form-row">
            <label for="email">邮箱</label>
            <input id="email" v-model.trim="formState.email" type="email" class="form-control" :disabled="loading" />
          </div>
          <div class="form-row">
            <label for="home-avatar-path">首页头像路径</label>
            <input
              id="home-avatar-path"
              v-model.trim="formState.homeAvatarPath"
              type="text"
              class="form-control"
              :disabled="loading"
              placeholder="可填静态路径或外链 URL"
            />
            <div class="upload-line">
              <a-upload
                :file-list="avatarUploadList"
                :before-upload="handleAvatarBeforeUpload"
                :max-count="1"
                accept="image/*"
                @remove="handleAvatarRemove"
              >
                <a-button size="small">
                  <UploadOutlined />
                  选择头像
                </a-button>
              </a-upload>
              <a-button size="small" type="default" :loading="avatarUploading" @click="handleAvatarUpload">上传头像</a-button>
            </div>
            <AppImage
              class="settings-image-preview avatar-preview"
              :src="resolveImagePath(formState.homeAvatarPath, '/img/profile-image.png')"
              alt="首页头像预览"
              fallback-src="/img/profile-image.png"
            />
          </div>
          <div class="form-row">
            <label for="home-hero-path">首页大图路径</label>
            <input
              id="home-hero-path"
              v-model.trim="formState.homeHeroPath"
              type="text"
              class="form-control"
              :disabled="loading"
              placeholder="可填静态路径或外链 URL"
            />
            <div class="upload-line">
              <a-upload
                :file-list="heroUploadList"
                :before-upload="handleHeroBeforeUpload"
                :max-count="1"
                accept="image/*"
                @remove="handleHeroRemove"
              >
                <a-button size="small">
                  <UploadOutlined />
                  选择大图
                </a-button>
              </a-upload>
              <a-button size="small" type="default" :loading="heroUploading" @click="handleHeroUpload">上传大图</a-button>
            </div>
            <AppImage
              class="settings-image-preview hero-preview"
              :src="resolveImagePath(formState.homeHeroPath, '/img/hero-image.jpg')"
              alt="首页大图预览"
              fallback-src="/img/hero-image.jpg"
            />
          </div>
          <div class="actions">
            <button class="btn btn-primary" type="submit" :disabled="submitting || loading">
              {{ submitting ? '保存中...' : '保存设置' }}
            </button>
          </div>
        </form>
      </div>

      <div class="settings-card password-card">
        <h3>修改密码</h3>
        <form class="settings-form" @submit.prevent="handlePasswordSubmit">
          <div class="form-row">
            <label for="current-password">当前密码</label>
            <input
              id="current-password"
              v-model="passwordState.currentPassword"
              type="password"
              class="form-control"
              :disabled="passwordSubmitting"
            />
          </div>
          <div class="form-row">
            <label for="next-password">新密码</label>
            <input
              id="next-password"
              v-model="passwordState.nextPassword"
              type="password"
              class="form-control"
              :disabled="passwordSubmitting"
            />
          </div>
          <div class="form-row">
            <label for="confirm-password">确认新密码</label>
            <input
              id="confirm-password"
              v-model="passwordState.confirmPassword"
              type="password"
              class="form-control"
              :disabled="passwordSubmitting"
            />
          </div>
          <div class="actions">
            <button class="btn btn-primary" type="submit" :disabled="passwordSubmitting">
              {{ passwordSubmitting ? '提交中...' : '更新密码' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-page {
  width: 100%;
}

.container {
  width: 95%;
  margin: 0 auto;
  max-width: none;
}

h2 {
  margin: 0 0 16px;
}

h3 {
  margin: 0 0 12px;
  color: var(--text);
}

.settings-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-soft);
  padding: 20px;
}

.password-card {
  margin-top: 16px;
}

.settings-form {
  display: grid;
  gap: 14px;
}

.form-row {
  display: grid;
  gap: 6px;
}

.form-row label {
  color: var(--text);
  font-weight: 600;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  border-radius: 4px;
  box-sizing: border-box;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.upload-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.settings-image-preview {
  margin-top: 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
}

.avatar-preview {
  width: 72px;
  height: 72px;
  object-fit: cover;
}

.hero-preview {
  width: min(100%, 24rem);
  height: 112px;
  object-fit: cover;
}

.btn {
  border: none;
  border-radius: 4px;
  padding: 8px 14px;
  cursor: pointer;
}

.btn-primary {
  background: var(--primary);
  color: var(--btn-text-on-primary);
}
</style>

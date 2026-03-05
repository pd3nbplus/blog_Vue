<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useFeedback } from '@/composables/useFeedback'
import { useTheme, type AppTheme } from '@/composables/useTheme'
import { useUserStore } from '@/stores/modules/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const feedback = useFeedback()
const { currentTheme, themeOptions, setTheme } = useTheme()

const formState = reactive({
  username: '',
  password: '',
})
const submitting = ref(false)

async function handleSubmit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    await userStore.doLogin(formState)
    feedback.success('登录成功')
    const redirect = (route.query.redirect as string) || '/admin/dashboard/'
    await router.push(redirect)
  } catch (error) {
    feedback.error(error)
  } finally {
    submitting.value = false
  }
}

function handleThemeChange(event: Event): void {
  const select = event.target as HTMLSelectElement
  setTheme(select.value as AppTheme)
}
</script>

<template>
  <div class="login-shell">
    <div class="theme-switcher login-theme-switcher">
      <label for="admin-login-theme-picker">主题</label>
      <select id="admin-login-theme-picker" :value="currentTheme" @change="handleThemeChange">
        <option v-for="item in themeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
      </select>
    </div>
    <div class="login-container">
      <div class="login-form">
        <div class="form-content">
          <h1 class="text-center">SIGN IN</h1>
          <form @submit.prevent="handleSubmit">
            <div class="field">
              <label for="username">Username:</label>
              <input id="username" v-model.trim="formState.username" type="text" required />
            </div>
            <div class="field">
              <label for="password">Password:</label>
              <input id="password" v-model="formState.password" type="password" required />
            </div>
            <button type="submit" class="btn btn-primary btn-block" :disabled="submitting">Login</button>
          </form>
        </div>
        <div class="copyright">
          <hr />
          <p>Copyright (c) 2024 Pdnbplus, all rights reserved. License</p>
        </div>
      </div>
      <div class="login-image">
        <img src="/img/background.jpg" alt="Login Image" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-shell {
  background: var(--bg);
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  position: relative;
}

.theme-switcher {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.6rem;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-2) 85%, transparent);
}

.theme-switcher label {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}

.theme-switcher select {
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  padding: 0 0.45rem;
}

.login-theme-switcher {
  position: absolute;
  right: 20px;
  top: 14px;
}

.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--surface);
  border-radius: 15px;
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--border);
  overflow: hidden;
  width: min(100%, 56rem);
  min-height: 60vh;
}

.login-form,
.login-image {
  flex: 1 1 21rem;
  min-width: min(100%, 18rem);
  height: 100%;
}

.login-image {
  flex: 1.2 1 24rem;
  min-width: min(100%, 16rem);
}

.login-form {
  padding: 20px;
  background-color: var(--surface-2);
  color: var(--text);
  border-top-left-radius: 15px;
  border-bottom-left-radius: 15px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.login-form form {
  width: 90%;
}

.login-form .form-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  flex-grow: 1;
}

.field {
  margin-bottom: 10px;
}

.field label {
  display: block;
  margin-bottom: 6px;
}

.field input {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 4px;
  padding: 8px 10px;
}

.btn {
  border: none;
  cursor: pointer;
}

.btn-primary {
  background-color: var(--primary);
  border-color: var(--primary);
  color: var(--btn-text-on-primary);
  border-radius: 4px;
  padding: 9px 10px;
}

.btn-primary:hover {
  filter: brightness(0.92);
}

.btn-block {
  width: 100%;
}

.login-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.2;
}

.login-form .copyright {
  font-size: 0.8em;
  text-align: center;
  margin-top: auto;
}

.login-form .copyright hr {
  border: 1px solid var(--border);
}

@media (max-width: 900px) {
  .login-container {
    flex-direction: column;
    min-height: auto;
  }

  .login-form,
  .login-image {
    width: 100%;
  }

  .login-image {
    min-height: 13rem;
  }
}
</style>

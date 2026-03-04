<script setup lang="ts">
interface Props {
  defaultRedirect?: string
}

const props = withDefaults(defineProps<Props>(), {
  defaultRedirect: '/',
})

import { useLoginPage } from '@/composables/pages/useLoginPage'

const { formState, submitting, handleSubmit } = useLoginPage({
  defaultRedirect: props.defaultRedirect,
})
</script>

<template>
  <div class="login-shell">
    <section class="login-container">
      <div class="login-form">
        <div class="form-content">
          <h1>SIGN IN</h1>
          <a-form :model="formState" layout="vertical" @finish="handleSubmit">
            <a-form-item label="用户名" name="username" :rules="[{ required: true, message: '请输入用户名' }]">
              <a-input v-model:value="formState.username" size="large" />
            </a-form-item>
            <a-form-item label="密码" name="password" :rules="[{ required: true, message: '请输入密码' }]">
              <a-input-password v-model:value="formState.password" size="large" />
            </a-form-item>
            <a-form-item>
              <a-button class="submit-btn" html-type="submit" type="primary" :loading="submitting" block size="large">
                登录
              </a-button>
            </a-form-item>
          </a-form>
        </div>
        <footer class="copyright">
          <hr />
          <p>Copyright (c) 2024 Pdnbplus, all rights reserved. License</p>
        </footer>
      </div>
      <div class="login-image">
        <img src="https://via.placeholder.com/600x800" alt="Login Image" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--bg);
}

.login-container {
  display: flex;
  width: min(100%, 56rem);
  min-height: 60vh;
  background: var(--surface);
  border-radius: 15px;
  overflow: hidden;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-soft);
}

.login-form {
  flex: 1 1 21rem;
  min-width: min(100%, 18rem);
  padding: 20px;
  color: var(--text);
  background: var(--surface-2);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.form-content {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.form-content h1 {
  text-align: center;
  margin: 0 0 24px;
  letter-spacing: 1px;
}

.submit-btn {
  background-color: var(--primary);
  border-color: var(--primary);
}

.submit-btn:hover,
.submit-btn:focus {
  filter: brightness(0.92);
}

.login-image {
  flex: 1.2 1 24rem;
  min-width: min(100%, 16rem);
}

.login-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.2;
}

.copyright {
  font-size: 12px;
  text-align: center;
  color: var(--muted);
}

.copyright hr {
  border: 1px solid var(--border);
}

.copyright p {
  margin: 8px 0 0;
}

@media (max-width: 900px) {
  .login-container {
    width: 100%;
    min-height: auto;
    flex-direction: column;
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

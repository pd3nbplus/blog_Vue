<script setup lang="ts">
import { reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'

import { useUserStore } from '@/stores/modules/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const formState = reactive({
  username: '',
  password: '',
})

async function handleSubmit() {
  try {
    await userStore.doLogin(formState)
    message.success('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    await router.push(redirect)
  } catch {
    message.error('登录失败，请检查账号密码')
  }
}
</script>

<template>
  <div class="simple-login-shell">
    <a-card title="登录" class="simple-login-card">
      <a-form layout="vertical" @finish="handleSubmit">
        <a-form-item label="用户名" name="username" :rules="[{ required: true, message: '请输入用户名' }]">
          <a-input v-model:value="formState.username" />
        </a-form-item>
        <a-form-item label="密码" name="password" :rules="[{ required: true, message: '请输入密码' }]">
          <a-input-password v-model:value="formState.password" />
        </a-form-item>
        <a-button type="primary" html-type="submit" block>登录</a-button>
      </a-form>
    </a-card>
  </div>
</template>

<style scoped>
.simple-login-shell {
  width: 100%;
  padding: 3rem 1rem;
}

.simple-login-card {
  width: min(92vw, 28rem);
  margin: 0 auto;
}
</style>

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getProfile, login, logout } from '@/services/api/user'
import type { UserProfile } from '@/types/user'
import { tokenStorage } from '@/utils/storage'

export const useUserStore = defineStore('user', () => {
  const token = ref(tokenStorage.get())
  const profile = ref<UserProfile | null>(null)

  const isLoggedIn = computed(() => Boolean(token.value))

  async function doLogin(payload: { username: string; password: string }): Promise<void> {
    const res = await login(payload)
    token.value = res.data.token
    tokenStorage.set(res.data.token)
    profile.value = res.data.user
  }

  async function fetchProfile(): Promise<void> {
    if (!token.value) return
    const res = await getProfile()
    profile.value = res.data
  }

  async function doLogout(): Promise<void> {
    try {
      if (token.value) {
        await logout()
      }
    } finally {
      token.value = null
      profile.value = null
      tokenStorage.remove()
    }
  }

  return {
    token,
    profile,
    isLoggedIn,
    doLogin,
    fetchProfile,
    doLogout,
  }
})

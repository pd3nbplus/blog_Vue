import type { Router } from 'vue-router'

import { useUserStore } from '@/stores/modules/user'

export function setupRouterGuards(router: Router): void {
  router.beforeEach(async (to) => {
    const userStore = useUserStore()
    const isAdminRoute = to.path === '/admin' || to.path.startsWith('/admin/')
    if (userStore.token && !userStore.profile) {
      try {
        await userStore.fetchProfile()
      } catch {
        await userStore.doLogout()
        if (isAdminRoute) {
          return { name: 'admin-login', query: { redirect: to.fullPath } }
        }
        return true
      }
    }

    if (to.name === 'admin-login' && userStore.isLoggedIn) {
      return { name: 'admin-dashboard' }
    }

    if (isAdminRoute && to.name !== 'admin-login' && !userStore.isLoggedIn) {
      return { name: 'admin-login', query: { redirect: to.fullPath } }
    }

    return true
  })
}

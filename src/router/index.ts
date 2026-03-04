import { createRouter, createWebHistory } from 'vue-router'

import { setupRouterGuards } from '@/router/guards'
import { routes } from '@/router/routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { left: 0, top: 0 }
  },
})

router.afterEach((to) => {
  if (to.hash) return
  requestAnimationFrame(() => {
    window.scrollTo({ left: 0, top: 0 })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  })
})

setupRouterGuards(router)

export default router

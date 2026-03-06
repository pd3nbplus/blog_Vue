import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { pinia } from './stores'
import { initDynamicFavicon } from './composables/useDynamicFavicon'
import { initThemeFromStorage } from './composables/useTheme'
import './styles/global.css'

initThemeFromStorage()
initDynamicFavicon()

const app = createApp(App)

app.use(pinia)
app.use(router)

app.mount('#app')

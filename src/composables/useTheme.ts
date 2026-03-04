import { computed, ref } from 'vue'

export type AppTheme = 'clean' | 'cloud-console' | 'ai-lab-neon' | 'vercel-noir'

const THEME_STORAGE_KEY = 'blog-theme'
const DEFAULT_THEME: AppTheme = 'ai-lab-neon'
const currentTheme = ref<AppTheme>(DEFAULT_THEME)
const initialized = ref(false)

export const APP_THEME_OPTIONS: Array<{ label: string; value: AppTheme }> = [
  { label: 'Clean（简洁风）', value: 'clean' },
  { label: 'Cloud Console（云控台）', value: 'cloud-console' },
  { label: 'AI Lab Neon（霓虹实验室）', value: 'ai-lab-neon' },
  { label: 'Vercel Noir（极简暗夜风）', value: 'vercel-noir' },
]

const LEGACY_THEME_ALIASES: Record<string, AppTheme> = {
  'wisteria-atelier': 'cloud-console',
}

function isAppTheme(value: string | null): value is AppTheme {
  return value === 'clean' || value === 'cloud-console' || value === 'ai-lab-neon' || value === 'vercel-noir'
}

function normalizeTheme(value: string | null): AppTheme | null {
  if (isAppTheme(value)) return value
  if (!value) return null
  return LEGACY_THEME_ALIASES[value] ?? null
}

function applyThemeToDom(theme: AppTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}

export function initThemeFromStorage() {
  if (initialized.value) return
  initialized.value = true
  if (typeof window === 'undefined') return
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  const theme = normalizeTheme(stored) ?? DEFAULT_THEME
  currentTheme.value = theme
  applyThemeToDom(theme)
  if (theme !== stored) {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }
}

function setTheme(theme: AppTheme) {
  currentTheme.value = theme
  applyThemeToDom(theme)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }
}

export function useTheme() {
  return {
    currentTheme,
    themeOptions: APP_THEME_OPTIONS,
    isDarkTheme: computed(() => currentTheme.value === 'ai-lab-neon' || currentTheme.value === 'vercel-noir'),
    setTheme,
    initThemeFromStorage,
  }
}

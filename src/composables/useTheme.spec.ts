import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useTheme legacy compatibility', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.resetModules()
  })

  it('migrates legacy wisteria-atelier theme to cloud-console', async () => {
    localStorage.setItem('blog-theme', 'wisteria-atelier')
    const themeModule = await import('@/composables/useTheme')
    themeModule.initThemeFromStorage()

    expect(themeModule.useTheme().currentTheme.value).toBe('cloud-console')
    expect(document.documentElement.getAttribute('data-theme')).toBe('cloud-console')
    expect(localStorage.getItem('blog-theme')).toBe('cloud-console')
  })
})

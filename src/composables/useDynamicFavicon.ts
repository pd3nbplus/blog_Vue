import { watch } from 'vue'

import type { AppTheme } from '@/composables/useTheme'
import { useTheme } from '@/composables/useTheme'

const SLACK_CIRCLE_FILLED_PATH =
  'M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zM361.5 580.2c0 27.8-22.5 50.4-50.3 50.4a50.35 50.35 0 01-50.3-50.4c0-27.8 22.5-50.4 50.3-50.4h50.3v50.4zm134 134.4c0 27.8-22.5 50.4-50.3 50.4-27.8 0-50.3-22.6-50.3-50.4V580.2c0-27.8 22.5-50.4 50.3-50.4a50.35 50.35 0 0150.3 50.4v134.4zm-50.2-218.4h-134c-27.8 0-50.3-22.6-50.3-50.4 0-27.8 22.5-50.4 50.3-50.4h134c27.8 0 50.3 22.6 50.3 50.4-.1 27.9-22.6 50.4-50.3 50.4zm0-134.4c-13.3 0-26.1-5.3-35.6-14.8S395 324.8 395 311.4c0-27.8 22.5-50.4 50.3-50.4 27.8 0 50.3 22.6 50.3 50.4v50.4h-50.3zm83.7-50.4c0-27.8 22.5-50.4 50.3-50.4 27.8 0 50.3 22.6 50.3 50.4v134.4c0 27.8-22.5 50.4-50.3 50.4-27.8 0-50.3-22.6-50.3-50.4V311.4zM579.3 765c-27.8 0-50.3-22.6-50.3-50.4v-50.4h50.3c27.8 0 50.3 22.6 50.3 50.4 0 27.8-22.5 50.4-50.3 50.4zm134-134.4h-134c-13.3 0-26.1-5.3-35.6-14.8S529 593.6 529 580.2c0-27.8 22.5-50.4 50.3-50.4h134c27.8 0 50.3 22.6 50.3 50.4 0 27.8-22.5 50.4-50.3 50.4zm0-134.4H663v-50.4c0-27.8 22.5-50.4 50.3-50.4s50.3 22.6 50.3 50.4c0 27.8-22.5 50.4-50.3 50.4z'

const THEME_ICON_COLORS: Record<AppTheme, string> = {
  clean: '#2563eb',
  'cloud-console': '#2f6fed',
  'ai-lab-neon': '#22d3ee',
  'vercel-noir': '#ffffff',
}

function buildSlackCircleFavicon(fillColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="64 64 896 896"><path fill="${fillColor}" d="${SLACK_CIRCLE_FILLED_PATH}"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function upsertFavicon(href: string): void {
  const elementId = 'app-dynamic-favicon'
  let link = document.querySelector<HTMLLinkElement>(`link#${elementId}`)
  if (!link) {
    link = document.createElement('link')
    link.id = elementId
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/svg+xml'
  link.href = href
}

export function initDynamicFavicon(): void {
  if (typeof document === 'undefined') return

  const { currentTheme } = useTheme()

  watch(
    currentTheme,
    theme => {
      upsertFavicon(buildSlackCircleFavicon(THEME_ICON_COLORS[theme]))
    },
    { immediate: true },
  )
}

<script setup lang="ts">
import { computed } from 'vue'
import { theme as antdTheme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'

import { useTheme } from '@/composables/useTheme'

const { currentTheme } = useTheme()

const THEME_TOKENS = {
  clean: {
    colorPrimary: '#2563eb',
    colorTextBase: '#1f2937',
    colorBgBase: '#f5f7fb',
    colorBgContainer: '#ffffff',
    borderRadius: 14,
  },
  'cloud-console': {
    colorPrimary: '#2f6fed',
    colorTextBase: '#1f365c',
    colorBgBase: '#edf3fb',
    colorBgContainer: '#ffffff',
    borderRadius: 16,
  },
  'ai-lab-neon': {
    colorPrimary: '#22d3ee',
    colorTextBase: '#e8f2ff',
    colorBgBase: '#070b14',
    colorBgContainer: '#101729',
    borderRadius: 14,
  },
  'vercel-noir': {
    colorPrimary: '#ffffff',
    colorTextBase: '#f5f5f5',
    colorBgBase: '#080808',
    colorBgContainer: '#111111',
    borderRadius: 12,
  },
} as const

const appThemeConfig = computed(() => {
  const theme = currentTheme.value
  const token = THEME_TOKENS[theme]
  const isDark = theme === 'ai-lab-neon' || theme === 'vercel-noir'

  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token,
  }
})
</script>

<template>
  <a-config-provider :locale="zhCN" :theme="appThemeConfig">
    <router-view />
  </a-config-provider>
</template>

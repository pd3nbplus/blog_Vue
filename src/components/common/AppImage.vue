<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { BACKEND_ORIGIN } from '@/utils/assets'
import { buildImageSourceCandidates, isRemoteHttpImage } from '@/utils/image'

const props = withDefaults(
  defineProps<{
    src?: string | null
    alt?: string
    fallbackSrc?: string
    proxyCsdn?: boolean
    preferProxy?: boolean
    noReferrerForRemote?: boolean
    hideOnError?: boolean
    loading?: 'lazy' | 'eager'
  }>(),
  {
    src: '',
    alt: '',
    fallbackSrc: '',
    proxyCsdn: true,
    preferProxy: true,
    noReferrerForRemote: true,
    hideOnError: false,
    loading: 'lazy',
  },
)

const emit = defineEmits<{
  error: [event: Event]
  load: [event: Event]
}>()

const candidates = computed(() =>
  buildImageSourceCandidates(props.src || '', {
    backendOrigin: BACKEND_ORIGIN,
    useProxyForCsdn: props.proxyCsdn,
    preferProxy: props.preferProxy,
  }),
)

const candidateIndex = ref(0)
const usingFallback = ref(false)
const hidden = ref(false)

watch(
  candidates,
  () => {
    candidateIndex.value = 0
    usingFallback.value = false
    hidden.value = false
  },
  { immediate: true },
)

const currentSrc = computed(() => {
  if (usingFallback.value) return props.fallbackSrc
  if (!candidates.value.length) return props.fallbackSrc
  return candidates.value[candidateIndex.value] || props.fallbackSrc
})

const referrerPolicy = computed(() => {
  if (!props.noReferrerForRemote) return undefined
  if (isRemoteHttpImage(currentSrc.value || '')) return 'no-referrer'
  return undefined
})

function handleError(event: Event) {
  if (!usingFallback.value && candidateIndex.value < candidates.value.length - 1) {
    candidateIndex.value += 1
    return
  }

  if (!usingFallback.value && props.fallbackSrc && currentSrc.value !== props.fallbackSrc) {
    usingFallback.value = true
    return
  }

  if (props.hideOnError) {
    hidden.value = true
  }

  emit('error', event)
}

function handleLoad(event: Event) {
  emit('load', event)
}
</script>

<template>
  <img
    v-if="!hidden && currentSrc"
    :src="currentSrc"
    :alt="alt"
    :loading="loading"
    :referrerpolicy="referrerPolicy"
    @error="handleError"
    @load="handleLoad"
  />
</template>

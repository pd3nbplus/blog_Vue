import { describe, expect, it } from 'vitest'

import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('mounts router shell', () => {
    const wrapper = mount(App, {
      global: {
        stubs: ['router-view', 'a-config-provider'],
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
})

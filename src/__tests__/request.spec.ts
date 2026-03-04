import { describe, expect, it } from 'vitest'
import { getApiErrorMessage } from '@/services/request'

describe('getApiErrorMessage', () => {
  it('prefers backend message in response envelope', () => {
    const error = {
      isAxiosError: true,
      message: 'Request failed with status code 400',
      response: { data: { code: 400, message: 'slug 已存在，请更换', data: { slug: ['duplicate'] } } },
    }
    expect(getApiErrorMessage(error)).toBe('slug 已存在，请更换')
  })

  it('handles axios string response body', () => {
    const error = {
      isAxiosError: true,
      message: 'Request failed with status code 500',
      response: { data: 'Internal Error' },
    }
    expect(getApiErrorMessage(error)).toBe('Internal Error')
  })

  it('falls back to generic error message', () => {
    expect(getApiErrorMessage(new Error('Network Error'))).toBe('Network Error')
    expect(getApiErrorMessage({ isAxiosError: true, message: 'unknown' })).toBe('unknown')
  })
})

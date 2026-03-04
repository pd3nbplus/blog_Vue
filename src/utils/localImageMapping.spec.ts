import { describe, expect, it } from 'vitest'

import { matchLocalImageRefs, mergeLocalImageFiles } from '@/utils/localImageMapping'

type MockFileOptions = {
  webkitRelativePath?: string
  size?: number
  lastModified?: number
}

function createMockFile(name: string, options: MockFileOptions = {}): File {
  const file = new File(['x'.repeat(options.size || 1)], name, {
    lastModified: options.lastModified || 1,
  })
  if (options.webkitRelativePath) {
    Object.defineProperty(file, 'webkitRelativePath', {
      configurable: true,
      value: options.webkitRelativePath,
    })
  }
  return file
}

describe('matchLocalImageRefs', () => {
  it('matches by path first when directory files are selected', () => {
    const refs = ['../img/a.png', '../img/b.png']
    const files = [
      createMockFile('a.png', { webkitRelativePath: 'chapter-1/img/a.png' }),
      createMockFile('b.png', { webkitRelativePath: 'chapter-1/img/b.png' }),
    ]

    const result = matchLocalImageRefs(refs, files)
    expect(result.mappings).toHaveLength(2)
    expect(result.ambiguousRefs).toHaveLength(0)
    expect(result.unmatchedRefs).toHaveLength(0)
    expect(result.previews.every((item) => item.strategy === 'path')).toBe(true)
  })

  it('falls back to filename when no relative path is available', () => {
    const refs = ['./assets/cover.jpg']
    const files = [createMockFile('cover.jpg')]

    const result = matchLocalImageRefs(refs, files)
    expect(result.mappings).toHaveLength(1)
    expect(result.previews[0]?.strategy).toBe('filename')
  })

  it('marks duplicate filename matches as ambiguous', () => {
    const refs = ['img/chart.png']
    const files = [
      createMockFile('chart.png', { webkitRelativePath: 'a/chart.png' }),
      createMockFile('chart.png', { webkitRelativePath: 'b/chart.png' }),
    ]

    const result = matchLocalImageRefs(refs, files)
    expect(result.mappings).toHaveLength(0)
    expect(result.ambiguousRefs).toEqual(['img/chart.png'])
    expect(result.previews[0]?.status).toBe('ambiguous')
  })

  it('marks missing refs as unmatched', () => {
    const result = matchLocalImageRefs(['img/missing.png'], [createMockFile('found.png')])
    expect(result.mappings).toHaveLength(0)
    expect(result.unmatchedRefs).toEqual(['img/missing.png'])
    expect(result.previews[0]?.status).toBe('unmatched')
  })
})

describe('mergeLocalImageFiles', () => {
  it('de-duplicates identical selected files', () => {
    const a1 = createMockFile('a.png', { webkitRelativePath: 'dir/a.png', size: 10, lastModified: 2 })
    const a2 = createMockFile('a.png', { webkitRelativePath: 'dir/a.png', size: 10, lastModified: 2 })
    const merged = mergeLocalImageFiles([a1], [a2])
    expect(merged).toHaveLength(1)
  })
})

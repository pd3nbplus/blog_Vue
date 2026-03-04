import { describe, expect, it } from 'vitest'

import { renderMarkdownContent } from '@/utils/markdown'

describe('renderMarkdownContent', () => {
  it('should convert [toc] marker to toc html', () => {
    const content = '[toc]\n\n# A\n\n## B'
    const result = renderMarkdownContent(content)
    expect(result.tocHtml).toContain('class="toc"')
    expect(result.tocHtml).toContain('#a')
    expect(result.html).toContain('class="toc"')
  })

  it('should convert @[toc] marker to toc html', () => {
    const content = '@[toc]\n\n# A'
    const result = renderMarkdownContent(content)
    expect(result.tocHtml).toContain('class="toc"')
    expect(result.tocHtml).toContain('#a')
  })

  it('should ignore toc marker inside fenced code block', () => {
    const content = '```markdown\n[toc]\n```\n\n# A'
    const result = renderMarkdownContent(content)
    expect(result.html).toContain('[toc]')
  })

  it('should normalize multiline $$ block math for downstream renderer', () => {
    const content = '$$\ny = \\\\beta_0 + \\\\beta_1x_1\n$$'
    const result = renderMarkdownContent(content)
    expect(result.html).not.toContain('$$<br>')
    expect(result.html).toContain('$$y = \\beta_0 + \\beta_1x_1$$')
  })

  it('should not normalize $$ marker inside fenced code block', () => {
    const content = '```text\n$$\ny = x\n$$\n```'
    const result = renderMarkdownContent(content)
    expect(result.html).toContain('$$')
    expect(result.html).toContain('<pre><code')
  })
})

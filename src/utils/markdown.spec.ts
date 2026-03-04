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
    expect(result.html).toContain('$$y = \\\\beta_0 + \\\\beta_1x_1$$')
  })

  it('should not normalize $$ marker inside fenced code block', () => {
    const content = '```text\n$$\ny = x\n$$\n```'
    const result = renderMarkdownContent(content)
    expect(result.html).toContain('$$')
    expect(result.html).toContain('<pre><code')
  })

  it('should normalize escaped $$ delimiter outside code blocks', () => {
    const content = '$$E({\\hat{\\beta_0}}) = \\beta_0\\ E({\\hat{\\beta_1}}) = \\beta_1\\$$'
    const result = renderMarkdownContent(content)
    expect(result.html).toContain('$$E({\\hat{\\beta_0}}) = \\beta_0\\ E({\\hat{\\beta_1}}) = \\beta_1$$')
  })

  it('should preserve underscore-heavy block math text before katex rendering', () => {
    const content = `$$
\\tilde{h}_{\\tau+1}^{n-1} = [SG(h_{\\tau}^{n-1}),h_{\\tau+1}^{n-1}] \\\\
q_{\\tau+1}^n,k_{\\tau+1}^n,v_{\\tau+1}^n = h_{\\tau+1}^{n-1}W_q^T
$$`
    const result = renderMarkdownContent(content)
    expect(result.html).toContain('$$\\tilde{h}_{\\tau+1}^{n-1}')
    expect(result.html).not.toContain('<em>')
  })
})

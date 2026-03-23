import type { Mermaid, MermaidConfig } from 'mermaid'

let mermaidInstancePromise: Promise<Mermaid> | null = null

async function loadMermaidInstance(): Promise<Mermaid> {
  if (!mermaidInstancePromise) {
    mermaidInstancePromise = import('mermaid').then((module) => {
      const instance = module.default
      instance.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
      })
      return instance
    })
  }
  return mermaidInstancePromise
}

function readCssVar(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = styles.getPropertyValue(name).trim()
  return value || fallback
}

function isDarkAppTheme(themeName: string | null): boolean {
  return themeName === 'ai-lab-neon' || themeName === 'vercel-noir'
}

function buildThemeConfig(): MermaidConfig {
  if (typeof document === 'undefined') {
    return {
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
    }
  }

  const root = document.documentElement
  const styles = window.getComputedStyle(root)
  const themeName = root.getAttribute('data-theme')
  const textColor = readCssVar(styles, '--text', '#1f2937')
  const mutedColor = readCssVar(styles, '--muted', '#6b7280')
  const borderColor = readCssVar(styles, '--border', '#d9e1ec')
  const primaryColor = readCssVar(styles, '--primary', '#2563eb')
  const surfaceColor = readCssVar(styles, '--surface', '#ffffff')
  const surfaceSubtleColor = readCssVar(styles, '--surface-2', '#f2f5fa')
  const fontFamily = readCssVar(styles, '--font-main', 'sans-serif')
  const darkMode = isDarkAppTheme(themeName)

  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      darkMode,
      background: 'transparent',
      fontFamily,
      fontSize: '14px',
      textColor,
      lineColor: textColor,
      edgeLabelBackground: surfaceColor,
      nodeTextColor: textColor,
      primaryColor: surfaceSubtleColor,
      primaryTextColor: textColor,
      primaryBorderColor: borderColor,
      secondaryColor: surfaceColor,
      secondaryTextColor: textColor,
      secondaryBorderColor: borderColor,
      tertiaryColor: surfaceSubtleColor,
      tertiaryTextColor: textColor,
      tertiaryBorderColor: borderColor,
      mainBkg: surfaceSubtleColor,
      secondBkg: surfaceColor,
      tertiaryBkg: surfaceSubtleColor,
      clusterBkg: surfaceColor,
      clusterBorder: borderColor,
      titleColor: textColor,
      actorTextColor: textColor,
      actorBorder: borderColor,
      actorBkg: surfaceSubtleColor,
      actorLineColor: textColor,
      signalColor: textColor,
      signalTextColor: textColor,
      labelBoxBkgColor: surfaceColor,
      labelBoxBorderColor: borderColor,
      labelTextColor: textColor,
      loopTextColor: mutedColor,
      noteTextColor: textColor,
      noteBorderColor: borderColor,
      noteBkgColor: surfaceSubtleColor,
      activationBorderColor: borderColor,
      activationBkgColor: surfaceSubtleColor,
      sequenceNumberColor: textColor,
      sectionBkgColor: surfaceSubtleColor,
      sectionBkgColor2: surfaceColor,
      sectionTitleColor: textColor,
      altSectionBkgColor: surfaceSubtleColor,
      gridColor: borderColor,
      cScale0: primaryColor,
      cScale1: borderColor,
      cScale2: surfaceSubtleColor,
    },
  }
}

export async function renderMermaidDiagrams(container: HTMLElement): Promise<void> {
  if (!container || typeof window === 'undefined') return
  const diagramNodes = container.querySelectorAll<HTMLElement>('div.mermaid')
  if (!diagramNodes.length) return

  try {
    const mermaid = await loadMermaidInstance()
    mermaid.initialize(buildThemeConfig())

    diagramNodes.forEach((node) => {
      const cachedSource = node.dataset.mermaidSource
      if (cachedSource) {
        node.textContent = cachedSource
      } else {
        node.dataset.mermaidSource = node.textContent || ''
      }
      node.removeAttribute('data-processed')
    })

    await mermaid.run({
      nodes: diagramNodes,
      suppressErrors: true,
    })
  } catch {
    // Keep markdown readable even if mermaid fails to parse.
  }
}

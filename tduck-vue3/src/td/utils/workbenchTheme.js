const DARK_CLASS = 'zy-dark'
const THEME_EVENT = 'zhiyan:theme-change'

// 工作台固定深色：不再提供浅色切换，也不读取系统偏好。
export function applyWorkbenchTheme() {
  const wasDark = document.documentElement.classList.contains(DARK_CLASS)
  document.documentElement.classList.add(DARK_CLASS)
  document.documentElement.style.colorScheme = 'dark'
  if (!wasDark) {
    // 图表是 canvas/svg，读不到 CSS 变量继承，需要按主题重绘。
    document.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { dark: true } }))
  }
  return true
}

export function initializeWorkbenchTheme() {
  return applyWorkbenchTheme()
}

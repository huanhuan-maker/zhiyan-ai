const STORAGE_KEY = 'zhiyan-workbench-theme'
const DARK_CLASS = 'zy-dark'

export function applyWorkbenchTheme(theme) {
  const dark = theme === 'dark'
  document.documentElement.classList.toggle(DARK_CLASS, dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  return dark
}

export function initializeWorkbenchTheme() {
  let saved = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch (e) {
    // Storage is optional; the theme remains usable for the current page.
  }
  const theme = saved === 'dark' || saved === 'light'
    ? saved
    : window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  return applyWorkbenchTheme(theme)
}

export function toggleWorkbenchTheme() {
  const dark = !document.documentElement.classList.contains(DARK_CLASS)
  applyWorkbenchTheme(dark ? 'dark' : 'light')
  try {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  } catch (e) {
    // Do not block the theme switch when browser storage is unavailable.
  }
  return dark
}

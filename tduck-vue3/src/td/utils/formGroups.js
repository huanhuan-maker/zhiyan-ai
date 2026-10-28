// 「我的问卷」列表：把后端 /user/form/page 返回的记录拆成文件夹和问卷。
// 后端用 folder 字段标记文件夹行（fm_user_form.is_folder），列表里两种记录混排；
// 页面需要分别渲染，且不能把文件夹算进「共 N 份问卷」。
// 这里保持纯函数，方便单测覆盖边界（字符串布尔、缺失字段、HTML 标题）。

export function isFolderRecord(record) {
  if (!record || typeof record !== 'object') return false
  const flag = record.folder
  return flag === true || flag === 1 || flag === '1' || flag === 'true'
}

export function splitFormRecords(records) {
  const folders = []
  const surveys = []
  const list = Array.isArray(records) ? records : []
  for (const record of list) {
    if (!record || typeof record !== 'object') continue
    if (isFolderRecord(record)) folders.push(record)
    else surveys.push(record)
  }
  return { folders, surveys }
}

const NAMED_ENTITIES = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  '#x27': "'",
  '#x2f': '/'
}

// 标题可能是富文本（例如 <h2 style="text-align: center;">标题</h2>），
// 展示前去掉标签并还原常见实体；不使用 innerHTML，避免 XSS。
export function plainTextName(value) {
  const source = value === null || value === undefined ? '' : String(value)
  return source
    .replace(/<[^>]*>/g, ' ')
    .replace(/&([a-zA-Z#0-9x]+);/g, (match, code) => {
      const key = String(code).toLowerCase()
      return NAMED_ENTITIES[key] === undefined ? match : NAMED_ENTITIES[key]
    })
    .replace(/\s+/g, ' ')
    .trim()
}

export function folderDisplayName(folder) {
  const source = folder && typeof folder === 'object' ? folder.textName || folder.name : folder
  return plainTextName(source) || '未命名文件夹'
}

// 文件夹里的问卷数未知时显示「文件夹」，不编造 0；已知 0 时明确显示空文件夹。
export function folderMetaLabel(count) {
  if (count === null || count === undefined || count === '') return '文件夹'
  const total = Number(count)
  if (!Number.isFinite(total)) return '文件夹'
  return total <= 0 ? '空文件夹' : `${total} 份问卷`
}

export function folderAriaLabel(folder, count) {
  return `打开文件夹 ${folderDisplayName(folder)}，${folderMetaLabel(count)}`
}

export function buildFolderBreadcrumb(folder) {
  const crumbs = [{ id: 0, name: '根目录' }]
  const rawId = folder && typeof folder === 'object' ? folder.id : folder
  const id = Number(rawId)
  if (Number.isFinite(id) && id > 0) {
    crumbs.push({ id, name: folderDisplayName(folder) })
  }
  return crumbs
}

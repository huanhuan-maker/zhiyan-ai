// 我的问卷卡片：把批量接口返回的收集份数合并进列表。
// 接口只返回本人问卷且可能缺少某些 key，缺失时保留 null，卡片显示占位而不是假的 0。
export function applyAnswerCounts(list, counts) {
  const map = counts && typeof counts === 'object' ? counts : {}
  return (Array.isArray(list) ? list : []).map((item) => {
    const raw = item && item.formKey != null ? map[String(item.formKey)] : undefined
    const value = raw === undefined || raw === null ? null : Number(raw)
    return { ...item, answerCount: Number.isFinite(value) ? value : null }
  })
}

// 卡片上显示的数字：未知用占位符，0 也要如实显示。
export function answerCountLabel(count) {
  return count === null || count === undefined ? '—' : String(count)
}

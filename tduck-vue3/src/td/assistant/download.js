export function csvCell(value) {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  // Spreadsheet applications must treat untrusted answer text as data, never formulas.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}
export function downloadFile(content, name, type = 'application/json;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function downloadAnswers(result) {
  const lines = [result.headers, ...result.rows].map(row => row.map(csvCell).join(','))
  downloadFile('\uFEFF' + lines.join('\r\n'), `问卷-${result.formKey}-V${result.version}.csv`, 'text/csv;charset=utf-8')
}

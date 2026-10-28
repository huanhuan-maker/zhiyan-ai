import { describe, expect, it } from 'vitest'
import {
  buildFolderBreadcrumb,
  folderAriaLabel,
  folderDisplayName,
  folderMetaLabel,
  isFolderRecord,
  plainTextName,
  splitFormRecords
} from '../../src/td/utils/formGroups'

describe('folder rows on 我的问卷', () => {
  it('只把 folder=true 的记录识别为文件夹，其它一律当问卷', () => {
    expect(isFolderRecord({ folder: true })).toBe(true)
    expect(isFolderRecord({ folder: 'true' })).toBe(true)
    expect(isFolderRecord({ folder: 1 })).toBe(true)
    expect(isFolderRecord({ folder: '1' })).toBe(true)
    expect(isFolderRecord({ folder: false })).toBe(false)
    expect(isFolderRecord({ folder: 0 })).toBe(false)
    expect(isFolderRecord({ folder: null })).toBe(false)
    expect(isFolderRecord({})).toBe(false)
    expect(isFolderRecord(null)).toBe(false)
  })

  it('保留记录顺序并按类型拆成 folders / surveys', () => {
    const records = [
      { id: 1, name: '文件夹 A', folder: true },
      { id: 2, name: '问卷 B' },
      { id: 3, name: '文件夹 C', folder: true },
      { id: 4, name: '问卷 D', folder: false }
    ]
    const { folders, surveys } = splitFormRecords(records)
    expect(folders.map((item) => item.id)).toEqual([1, 3])
    expect(surveys.map((item) => item.id)).toEqual([2, 4])
  })

  it('容忍空值和非数组，不破坏列表', () => {
    expect(splitFormRecords(null)).toEqual({ folders: [], surveys: [] })
    expect(splitFormRecords('oops')).toEqual({ folders: [], surveys: [] })
    expect(splitFormRecords([null, undefined, 1, 'x'])).toEqual({ folders: [], surveys: [] })
  })

  it('文件夹名去掉富文本标签与实体后再展示', () => {
    expect(plainTextName('<h2 style="text-align: center;">归档&nbsp;2026</h2>')).toBe('归档 2026')
    expect(plainTextName('  A &amp; B  ')).toBe('A & B')
    expect(plainTextName('A <span class="x">B</span> C')).toBe('A B C')
    expect(folderDisplayName({ textName: '<b>验收归档</b>' })).toBe('验收归档')
    expect(folderDisplayName({ name: '<i>父级</i>' })).toBe('父级')
  })

  it('文件夹名为空时给出占位而不是空白卡片', () => {
    expect(folderDisplayName({ name: '' })).toBe('未命名文件夹')
    expect(folderDisplayName(null)).toBe('未命名文件夹')
  })

  it('问卷数未知显示「文件夹」、0 份显示空文件夹、其余显示真实份数', () => {
    expect(folderMetaLabel(null)).toBe('文件夹')
    expect(folderMetaLabel(undefined)).toBe('文件夹')
    expect(folderMetaLabel(NaN)).toBe('文件夹')
    expect(folderMetaLabel('abc')).toBe('文件夹')
    expect(folderMetaLabel(0)).toBe('空文件夹')
    expect(folderMetaLabel('0')).toBe('空文件夹')
    expect(folderMetaLabel(1)).toBe('1 份问卷')
    expect(folderMetaLabel('12')).toBe('12 份问卷')
  })

  it('aria-label 同时说明名称与内部问卷数', () => {
    expect(folderAriaLabel({ name: 'Archive - acceptance fixture' }, 1)).toBe(
      '打开文件夹 Archive - acceptance fixture，1 份问卷'
    )
    expect(folderAriaLabel({ name: '空归档' }, null)).toBe('打开文件夹 空归档，文件夹')
  })

  it('面包屑固定从根目录开始，文件夹名使用纯文本', () => {
    expect(buildFolderBreadcrumb(null)).toEqual([{ id: 0, name: '根目录' }])
    expect(buildFolderBreadcrumb({ id: 9138, name: '<b>Archive - acceptance fixture</b>' })).toEqual([
      { id: 0, name: '根目录' },
      { id: 9138, name: 'Archive - acceptance fixture' }
    ])
  })
})

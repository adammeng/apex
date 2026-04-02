import type { CSSProperties } from 'react'
import type { TooltipDrug } from '../../services/analysis'

const scorePalette = [
  { min: 4,   background: '#1e40af', color: '#fff',     borderColor: '#1e3a8a' },
  { min: 3.5, background: '#2563eb', color: '#fff',     borderColor: '#1d4ed8' },
  { min: 3,   background: '#3b82f6', color: '#fff',     borderColor: '#2563eb' },
  { min: 2.5, background: '#93c5fd', color: '#1e3a8a',  borderColor: '#60a5fa' },
  { min: 2,   background: '#bfdbfe', color: '#1e3a8a',  borderColor: '#93c5fd' },
  { min: 1.5, background: '#dbeafe', color: '#1e3a8a',  borderColor: '#bfdbfe' },
  { min: 1,   background: '#eff6ff', color: '#1e40af',  borderColor: '#dbeafe' },
  { min: 0.5, background: '#f8faff', color: '#3b82f6',  borderColor: '#e0eaff' },
  { min: 0.1, background: '#f8fafc', color: '#64748b',  borderColor: '#e2e8f0' }
]

export function getScoreStyle(score?: number | null, inactive = false): CSSProperties {
  if (!score || inactive) {
    return {
      background: inactive ? '#eef2f9' : '#f8fafc',
      color: '#8a94a6',
      borderColor: '#e4e9f1'
    }
  }

  return scorePalette.find((item) => score >= item.min) ?? scorePalette[scorePalette.length - 1]
}

export function getDrugDisplayName(drug: Pick<TooltipDrug, 'drug_name_en' | 'drug_name_cn'>) {
  return drug.drug_name_en || drug.drug_name_cn || '-'
}

export function getCellKey(rowTarget: string, colTarget: string) {
  return [rowTarget, colTarget].sort((left, right) => left.localeCompare(right)).join('::')
}

/** 将二维字符串数组转为 CSV 内容（UTF-8 BOM，兼容 Excel 中文） */
export function buildCsv(rows: string[][]): string {
  const csv = rows
    .map((cols) =>
      cols
        .map((cell) => {
          const str = cell == null ? '' : String(cell)
          // 包含逗号、引号、换行时用双引号包裹，内部引号转义
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(',')
    )
    .join('\r\n')
  // UTF-8 BOM 让 Excel 正确识别中文
  return '\uFEFF' + csv
}

/** 触发浏览器下载 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

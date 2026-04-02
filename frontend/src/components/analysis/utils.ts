import type { CSSProperties } from 'react'
import type { TooltipDrug } from '../../services/analysis'

const scorePalette = [
  { min: 4, background: '#113a8f', color: '#fff', borderColor: '#113a8f' },
  { min: 3.5, background: '#2454c5', color: '#fff', borderColor: '#2454c5' },
  { min: 3, background: '#4c7ee8', color: '#fff', borderColor: '#4c7ee8' },
  { min: 2.5, background: '#8fb0ff', color: '#17336b', borderColor: '#8fb0ff' },
  { min: 2, background: '#bad0ff', color: '#17336b', borderColor: '#bad0ff' },
  { min: 1.5, background: '#d6e2ff', color: '#17336b', borderColor: '#d6e2ff' },
  { min: 1, background: '#e4ecff', color: '#17336b', borderColor: '#e4ecff' },
  { min: 0.5, background: '#eef4ff', color: '#17336b', borderColor: '#d7e4ff' },
  { min: 0.1, background: '#f5f7fb', color: '#536079', borderColor: '#e5ebf5' }
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

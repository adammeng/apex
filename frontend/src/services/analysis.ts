import request from './request'

export interface MatrixQueryParams {
  diseases?: string[]
  ta?: string
  stages?: string[]
  targets?: string[]
  hide_no_combo?: boolean
}

export interface TooltipParams {
  row_target: string
  col_target: string
  diseases?: string[]
  ta?: string
  stages?: string[]
}

export interface MatrixCell {
  row_target: string
  col_target: string
  score: number
  stage_value: string
  drug_count: number
}

export interface MatrixSingleMax {
  score: number
  stage_value: string
}

export interface MatrixQueryResult {
  targets: string[]
  single_max: Record<string, MatrixSingleMax>
  cells: MatrixCell[]
  legend: Array<{
    value: string
    score: number
    matrix: string
    pipeline: string
  }>
  data_version: string | null
  available_target_total: number
  display_target_total: number
}

export interface TooltipDrug {
  drug_id: string
  drug_name_en: string
  drug_name_cn: string
  originator: string
  research_institute: string
  highest_trial_date: string
  nct_id: string
  disease: string
  ta: string
  stage_value: string
  score: number
  targets: string[]
  is_combo: boolean
}

export interface MatrixTooltipResult {
  row_target: string
  col_target: string
  is_single: boolean
  drugs: TooltipDrug[]
  data_version: string | null
}

export interface PipelineRow {
  target: string
  max_score: number
  total_drug_count: number
  cells: Record<string, TooltipDrug[]>
}

export interface PipelineQueryResult {
  disease: string
  lanes: string[]
  rows: PipelineRow[]
  data_version: string | null
}

interface PipelineQueryParams {
  disease: string
  targets?: string[]
  include_combo?: boolean
}

function buildQueryString(params: object) {
  const searchParams = new URLSearchParams()

  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value == null) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item != null) {
          searchParams.append(key, String(item))
        }
      })
      return
    }

    searchParams.append(key, String(value))
  })

  return searchParams.toString()
}

async function downloadExportFile(path: string, params: object) {
  const baseUrl = request.defaults.baseURL ?? '/api'
  const queryString = buildQueryString(params)
  const url = queryString ? `${baseUrl}${path}?${queryString}` : `${baseUrl}${path}`
  const token = localStorage.getItem('access_token')

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (response.status === 401) {
    localStorage.removeItem('access_token')
    window.location.href = '/login'
    return
  }

  if (!response.ok) {
    throw new Error('导出失败')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') ?? ''
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/)
  const filename = filenameMatch?.[1] ?? 'export.xlsx'
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(downloadUrl)
}

export const matrixApi = {
  query: (params: MatrixQueryParams) =>
    request.post<any, any>('/matrix/query', params).then((r) => r.data.data as MatrixQueryResult),

  tooltip: (params: TooltipParams) =>
    request
      .post<any, any>('/matrix/tooltip', params)
      .then((r) => r.data.data as MatrixTooltipResult),

  exportExcel: (params: MatrixQueryParams) => downloadExportFile('/matrix/export', params),
}

export const pipelineApi = {
  query: (params: PipelineQueryParams) =>
    request
      .post<any, any>('/pipeline/query', params)
      .then((r) => r.data.data as PipelineQueryResult),

  exportExcel: (params: PipelineQueryParams) => downloadExportFile('/pipeline/export', params),
}

import request from './request'

export interface MatrixQueryParams {
  diseases?: string[]
  ta?: string
  stages?: string[]
  targets?: string[]
  top_n?: number
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

export const matrixApi = {
  query: (params: MatrixQueryParams) =>
    request.post<any, any>('/matrix/query', params).then((r) => r.data.data as MatrixQueryResult),

  tooltip: (params: TooltipParams) =>
    request
      .post<any, any>('/matrix/tooltip', params)
      .then((r) => r.data.data as MatrixTooltipResult),

  exportUrl: '/api/matrix/export',
}

export const pipelineApi = {
  query: (params: { disease: string; targets?: string[]; include_combo?: boolean }) =>
    request
      .post<any, any>('/pipeline/query', params)
      .then((r) => r.data.data as PipelineQueryResult),

  exportUrl: '/api/pipeline/export',
}

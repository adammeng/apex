import request from './request'

export interface MatrixQueryParams {
  diseases?: string[]
  ta?: string
  min_stage_score?: number
  targets?: string[]
  top_n?: number
}

export interface TooltipParams {
  row_target: string
  col_target: string
  diseases?: string[]
  ta?: string
}

export const matrixApi = {
  query: (params: MatrixQueryParams) =>
    request.post<any, any>('/matrix/query', params).then((r) => r.data.data),

  tooltip: (params: TooltipParams) =>
    request.post<any, any>('/matrix/tooltip', params).then((r) => r.data.data),

  exportUrl: '/api/matrix/export',
}

export const pipelineApi = {
  query: (params: { disease: string; targets?: string[]; include_combo?: boolean }) =>
    request.post<any, any>('/pipeline/query', params).then((r) => r.data.data),

  exportUrl: '/api/pipeline/export',
}

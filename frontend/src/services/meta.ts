import request from './request'

export interface DiseaseTree {
  ta: string
  children: { name: string; drug_count: number }[]
}

export interface StageItem {
  value: string
  score: number
  matrix: string
  pipeline: string
}

export const metaApi = {
  getDiseaseTree: () =>
    request.get<any, any>('/meta/disease-tree').then((r) => r.data.data as DiseaseTree[]),

  getTargets: (disease?: string) =>
    request
      .get<any, any>('/meta/targets', { params: disease ? { disease } : {} })
      .then((r) => r.data.data as { targets: string[]; total: number }),

  getStages: () =>
    request.get<any, any>('/meta/stages').then((r) => r.data.data as StageItem[]),
}

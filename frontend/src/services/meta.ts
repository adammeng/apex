import request from './request'

export interface DiseaseTree {
  ta: string
  children: { name: string; drug_count: number }[]
}

export interface DiseaseOption {
  ta: string
  name: string
  drug_count: number
}

export interface StageItem {
  value: string
  score: number
  matrix: string
  pipeline: string
}

export interface TargetGroup {
  key: string
  targets: string[]
}

export interface FilterDictionaries {
  disease_tree: DiseaseTree[]
  diseases: DiseaseOption[]
  stages: StageItem[]
}

export const metaApi = {
  getDiseaseTree: () =>
    request.get<any, any>('/meta/disease-tree').then((r) => r.data.data as DiseaseTree[]),

  getTargets: (disease?: string) =>
    request
      .get<any, any>('/meta/targets', { params: disease ? { disease } : {} })
      .then((r) => r.data.data as { targets: string[]; groups: TargetGroup[]; total: number }),

  getStages: () =>
    request.get<any, any>('/meta/stages').then((r) => r.data.data as StageItem[]),

  getDictionaries: () =>
    request.get<any, any>('/meta/dictionaries').then((r) => r.data.data as FilterDictionaries),
}

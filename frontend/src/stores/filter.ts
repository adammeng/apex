import { create } from 'zustand'

interface FilterState {
  // 选中的治疗领域
  selectedTa: string | null
  // 选中的适应症列表
  selectedDiseases: string[]
  // 选中的靶点列表
  selectedTargets: string[]
  // 最低阶段分值
  minStageScore: number | null

  setTa: (ta: string | null) => void
  setDiseases: (diseases: string[]) => void
  setTargets: (targets: string[]) => void
  setMinStageScore: (score: number | null) => void
  resetFilters: () => void
}

const initialState = {
  selectedTa: null,
  selectedDiseases: [],
  selectedTargets: [],
  minStageScore: null,
}

export const useFilterStore = create<FilterState>((set) => ({
  ...initialState,

  setTa: (ta) => set({ selectedTa: ta }),
  setDiseases: (diseases) => set({ selectedDiseases: diseases }),
  setTargets: (targets) => set({ selectedTargets: targets }),
  setMinStageScore: (score) => set({ minStageScore: score }),
  resetFilters: () => set(initialState),
}))

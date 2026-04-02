import { create } from 'zustand'

interface MatrixFilterState {
  selectedDiseases: string[]
  selectedStages: string[]
  hideNoCombo: boolean
  initialized: boolean
}

interface PipelineFilterState {
  selectedDisease?: string
  selectedTargets: string[]
  includeCombo: boolean
  targetsHydratedDisease?: string
}

interface FilterState {
  matrix: MatrixFilterState
  pipeline: PipelineFilterState
  initializeMatrix: (payload: Pick<MatrixFilterState, 'selectedDiseases' | 'selectedStages'>) => void
  setMatrixDiseases: (diseases: string[]) => void
  setMatrixStages: (stages: string[]) => void
  setMatrixHideNoCombo: (hideNoCombo: boolean) => void
  resetMatrix: (payload: Pick<MatrixFilterState, 'selectedDiseases' | 'selectedStages'>) => void
  setPipelineDisease: (disease?: string) => void
  setPipelineTargets: (targets: string[]) => void
  setPipelineIncludeCombo: (includeCombo: boolean) => void
  markPipelineTargetsHydrated: (disease?: string) => void
  resetPipeline: (payload: { disease?: string; targets?: string[] }) => void
}

const initialMatrixState: MatrixFilterState = {
  selectedDiseases: [],
  selectedStages: [],
  hideNoCombo: false,
  initialized: false,
}

const initialPipelineState: PipelineFilterState = {
  selectedDisease: undefined,
  selectedTargets: [],
  includeCombo: true,
  targetsHydratedDisease: undefined,
}

export const useFilterStore = create<FilterState>((set) => ({
  matrix: initialMatrixState,
  pipeline: initialPipelineState,

  initializeMatrix: ({ selectedDiseases, selectedStages }) =>
    set((state) => {
      if (state.matrix.initialized) {
        return state
      }

      return {
        matrix: {
          ...state.matrix,
          selectedDiseases,
          selectedStages,
          initialized: true,
        },
      }
    }),

  setMatrixDiseases: (selectedDiseases) =>
    set((state) => ({
      matrix: {
        ...state.matrix,
        selectedDiseases,
      },
    })),

  setMatrixStages: (selectedStages) =>
    set((state) => ({
      matrix: {
        ...state.matrix,
        selectedStages,
      },
    })),

  setMatrixHideNoCombo: (hideNoCombo) =>
    set((state) => ({
      matrix: {
        ...state.matrix,
        hideNoCombo,
      },
    })),

  resetMatrix: ({ selectedDiseases, selectedStages }) =>
    set((state) => ({
      matrix: {
        ...state.matrix,
        selectedDiseases,
        selectedStages,
        hideNoCombo: false,
        initialized: true,
      },
    })),

  setPipelineDisease: (selectedDisease) =>
    set((state) => ({
      pipeline: {
        ...state.pipeline,
        selectedDisease,
      },
    })),

  setPipelineTargets: (selectedTargets) =>
    set((state) => ({
      pipeline: {
        ...state.pipeline,
        selectedTargets,
      },
    })),

  setPipelineIncludeCombo: (includeCombo) =>
    set((state) => ({
      pipeline: {
        ...state.pipeline,
        includeCombo,
      },
    })),

  markPipelineTargetsHydrated: (targetsHydratedDisease) =>
    set((state) => ({
      pipeline: {
        ...state.pipeline,
        targetsHydratedDisease,
      },
    })),

  resetPipeline: ({ disease, targets }) =>
    set((state) => ({
      pipeline: {
        ...state.pipeline,
        selectedDisease: disease,
        selectedTargets: targets ?? [],
        includeCombo: true,
        targetsHydratedDisease: targets ? disease : undefined,
      },
    })),
}))

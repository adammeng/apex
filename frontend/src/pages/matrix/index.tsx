import { Button, Switch, Tooltip, message } from 'antd'
import { DownloadOutlined, FullscreenExitOutlined, FullscreenOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import MatrixBoard from '../../components/analysis/MatrixBoard'
import type { MatrixBoardHandle } from '../../components/analysis/MatrixBoard'
import { DiseaseTreeFilter, StageFilter } from '../../components/analysis/filters'
import { matrixApi } from '../../services/analysis'
import { metaApi } from '../../services/meta'
import { useFilterStore } from '../../stores/filter'
import '../analysis.css'

export default function MatrixPage() {
  const matrix = useFilterStore((state) => state.matrix)
  const initializeMatrix = useFilterStore((state) => state.initializeMatrix)
  const setMatrixDiseases = useFilterStore((state) => state.setMatrixDiseases)
  const setMatrixStages = useFilterStore((state) => state.setMatrixStages)
  const setMatrixHideNoCombo = useFilterStore((state) => state.setMatrixHideNoCombo)
  const resetMatrix = useFilterStore((state) => state.resetMatrix)

  const boardRef = useRef<MatrixBoardHandle>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const { data: dictionaries } = useQuery({
    queryKey: ['analysis-dictionaries'],
    queryFn: metaApi.getDictionaries,
  })

  const allDiseases = useMemo(
    () => dictionaries?.diseases.map((item) => item.name) ?? [],
    [dictionaries]
  )
  const allStageValues = useMemo(
    () => dictionaries?.stages.map((item) => item.value) ?? [],
    [dictionaries]
  )

  useEffect(() => {
    if (!dictionaries) return
    initializeMatrix({
      selectedDiseases: allDiseases,
      selectedStages: allStageValues,
    })
  }, [allDiseases, allStageValues, dictionaries, initializeMatrix])

  const { data, isLoading } = useQuery({
    queryKey: ['matrix-query', matrix.selectedDiseases, matrix.selectedStages, matrix.hideNoCombo],
    queryFn: () =>
      matrixApi.query({
        diseases: matrix.selectedDiseases,
        stages: matrix.selectedStages,
        top_n: 40,
        hide_no_combo: matrix.hideNoCombo,
      }),
    enabled: matrix.selectedDiseases.length > 0 && matrix.selectedStages.length > 0,
  })

  function handleReset() {
    resetMatrix({
      selectedDiseases: allDiseases,
      selectedStages: allStageValues,
    })
  }

  function handleToggleFullscreen() {
    void boardRef.current?.toggleFullscreen().then(() => {
      setIsFullscreen(boardRef.current?.isFullscreen ?? false)
    })
  }

  async function handleExport() {
    try {
      await matrixApi.exportExcel({
        diseases: matrix.selectedDiseases,
        stages: matrix.selectedStages,
        top_n: 40,
        hide_no_combo: matrix.hideNoCombo,
      })
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导出失败')
    }
  }

  return (
    <div className="analysis-page">
      <div className="analysis-page__hero">
        <div className="analysis-filter-bar analysis-filter-bar--inline">
          <div className="analysis-filter-bar__item">
            <span className="analysis-filter-bar__label">疾病</span>
            <DiseaseTreeFilter
              diseaseTree={dictionaries?.disease_tree ?? []}
              value={matrix.selectedDiseases}
              onChange={setMatrixDiseases}
            />
          </div>

          <div className="analysis-filter-bar__item">
            <span className="analysis-filter-bar__label">阶段</span>
            <StageFilter
              stages={dictionaries?.stages ?? []}
              value={matrix.selectedStages}
              onChange={setMatrixStages}
            />
          </div>

          <Button
            size="small"
            icon={<ReloadOutlined />}
            className="analysis-filter-btn"
            onClick={handleReset}
          >
            重置
          </Button>

          <label className="analysis-filter-switch">
            <Switch size="small" checked={matrix.hideNoCombo} onChange={setMatrixHideNoCombo} />
            <span>隐藏无组合</span>
          </label>
        </div>

        <div className="analysis-page__meta">
          <Tooltip title="导出当前矩阵为 Excel">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              className="analysis-action-btn"
              onClick={() => void handleExport()}
            />
          </Tooltip>
          <Tooltip title={isFullscreen ? '退出全屏' : '全屏查看'}>
            <Button
              type="text"
              size="small"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              className="analysis-action-btn"
              onClick={handleToggleFullscreen}
            />
          </Tooltip>
        </div>
      </div>

      <MatrixBoard
        ref={boardRef}
        data={data}
        isLoading={isLoading}
        diseases={matrix.selectedDiseases}
        stages={matrix.selectedStages}
        total={data?.available_target_total}
      />
    </div>
  )
}

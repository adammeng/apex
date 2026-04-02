import { Button, Card, Space, Switch, Tag, Typography } from 'antd'
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import MatrixBoard from '../../components/analysis/MatrixBoard'
import { DiseaseTreeFilter, StageFilter } from '../../components/analysis/filters'
import { matrixApi } from '../../services/analysis'
import { metaApi } from '../../services/meta'
import { useFilterStore } from '../../stores/filter'
import '../analysis.css'

const { Title, Text } = Typography

export default function MatrixPage() {
  const matrix = useFilterStore((state) => state.matrix)
  const initializeMatrix = useFilterStore((state) => state.initializeMatrix)
  const setMatrixDiseases = useFilterStore((state) => state.setMatrixDiseases)
  const setMatrixStages = useFilterStore((state) => state.setMatrixStages)
  const setMatrixHideNoCombo = useFilterStore((state) => state.setMatrixHideNoCombo)
  const resetMatrix = useFilterStore((state) => state.resetMatrix)

  const { data: dictionaries, isLoading: dictionariesLoading } = useQuery({
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
    if (!dictionaries) {
      return
    }

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

  return (
    <div className="analysis-page">
      <div className="analysis-page__hero">
        <div className="analysis-page__hero-left">
          <Title level={3}>靶点组合竞争格局</Title>
          <p>以疾病维度筛选最新临床记录，按靶点最高研发阶段生成组合热力矩阵。</p>
        </div>
        <div className="analysis-page__meta">
          {data?.available_target_total != null && (
            <Tag color="geekblue">靶点数 {data.available_target_total}</Tag>
          )}
          {data?.targets?.length != null && (
            <Tag color="cyan">当前展示 {data.targets.length}</Tag>
          )}
        </div>
      </div>

      <Card loading={dictionariesLoading} className="analysis-filter-card">
        <div className="analysis-filter-bar">
          <FilterOutlined style={{ color: '#8494b0', flexShrink: 0 }} />

          <div className="analysis-filter-bar__item">
            <span className="analysis-filter-bar__label">疾病筛选</span>
            <DiseaseTreeFilter
              diseaseTree={dictionaries?.disease_tree ?? []}
              value={matrix.selectedDiseases}
              onChange={setMatrixDiseases}
            />
          </div>

          <div className="analysis-filter-bar__item">
            <span className="analysis-filter-bar__label">研发阶段</span>
            <StageFilter
              stages={dictionaries?.stages ?? []}
              value={matrix.selectedStages}
              onChange={setMatrixStages}
            />
          </div>

          <div className="analysis-filter-bar__actions">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              className="analysis-filter-btn"
              onClick={handleReset}
            >
              重置筛选
            </Button>
          </div>

          <div style={{ flex: 1 }} />

          <div className="analysis-filter-bar__divider" />

          <Space size={6}>
            <Switch size="small" checked={matrix.hideNoCombo} onChange={setMatrixHideNoCombo} />
            <Text style={{ whiteSpace: 'nowrap', fontSize: 13, color: '#52617c' }}>隐藏无组合的靶点</Text>
          </Space>
        </div>
      </Card>

      <MatrixBoard
        data={data}
        isLoading={isLoading}
        diseases={matrix.selectedDiseases}
        stages={matrix.selectedStages}
      />
    </div>
  )
}

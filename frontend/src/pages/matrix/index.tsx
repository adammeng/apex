import { Button, Card, Space, Switch, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
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

  return (
    <div className="analysis-page">
      <div className="analysis-page__hero">
        <div>
          <Title level={3}>靶点组合竞争格局</Title>
          <p>
            以疾病维度筛选最新临床记录，按靶点最高研发阶段生成组合热力矩阵。悬浮任一分值格会单独请求
            tooltip 明细，不和主 query 混在一起。
          </p>
        </div>
        <div className="analysis-page__meta">
          {data?.available_target_total ? <Tag color="geekblue">靶点数 {data.available_target_total}</Tag> : null}
          {data?.targets?.length ? <Tag color="cyan">当前展示 {data.targets.length}</Tag> : null}
        </div>
      </div>

      <Card loading={dictionariesLoading}>
        <div className="analysis-filter-grid">
          <div className="analysis-filter-group">
            <div className="analysis-filter-group__label">疾病筛选</div>
            <DiseaseTreeFilter
              diseaseTree={dictionaries?.disease_tree ?? []}
              value={matrix.selectedDiseases}
              onChange={setMatrixDiseases}
            />
          </div>

          <div className="analysis-filter-group">
            <div className="analysis-filter-group__label">研发阶段</div>
            <StageFilter
              stages={dictionaries?.stages ?? []}
              value={matrix.selectedStages}
              onChange={setMatrixStages}
            />
          </div>

          <div className="analysis-filter-side">
            <div className="analysis-filter-group__label">显示控制</div>
            <Space direction="vertical" size={12}>
              <Space>
                <Switch checked={matrix.hideNoCombo} onChange={setMatrixHideNoCombo} />
                <Text>隐藏无组合的靶点</Text>
              </Space>
              <div className="analysis-filter-side__actions">
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
              </div>
              <div className="analysis-hint">
                当前按最高研发阶段排序，默认展示当前筛选条件下的 Top 40 靶点。
              </div>
            </Space>
          </div>
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

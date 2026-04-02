import { Button, Card, Space, Switch, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import MatrixBoard from '../../components/analysis/MatrixBoard'
import { DiseaseTreeFilter, StageFilter } from '../../components/analysis/filters'
import { matrixApi } from '../../services/analysis'
import { metaApi } from '../../services/meta'
import '../analysis.css'

const { Title, Text } = Typography

export default function MatrixPage() {
  const initializedRef = useRef(false)
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([])
  const [selectedStages, setSelectedStages] = useState<string[]>([])
  const [hideNoCombo, setHideNoCombo] = useState(false)

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
    if (!dictionaries || initializedRef.current) {
      return
    }

    setSelectedDiseases(allDiseases)
    setSelectedStages(allStageValues)
    initializedRef.current = true
  }, [allDiseases, allStageValues, dictionaries])

  const { data, isLoading } = useQuery({
    queryKey: ['matrix-query', selectedDiseases, selectedStages, hideNoCombo],
    queryFn: () =>
      matrixApi.query({
        diseases: selectedDiseases,
        stages: selectedStages,
        hide_no_combo: hideNoCombo,
      }),
    enabled: selectedDiseases.length > 0 && selectedStages.length > 0,
  })

  function handleReset() {
    setSelectedDiseases(allDiseases)
    setSelectedStages(allStageValues)
    setHideNoCombo(false)
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
        </div>
      </div>

      <Card loading={dictionariesLoading}>
        <div className="analysis-filter-grid">
          <div className="analysis-filter-group">
            <div className="analysis-filter-group__label">疾病筛选</div>
            <DiseaseTreeFilter
              diseaseTree={dictionaries?.disease_tree ?? []}
              value={selectedDiseases}
              onChange={setSelectedDiseases}
            />
          </div>

          <div className="analysis-filter-group">
            <div className="analysis-filter-group__label">研发阶段</div>
            <StageFilter
              stages={dictionaries?.stages ?? []}
              value={selectedStages}
              onChange={setSelectedStages}
            />
          </div>

          <div className="analysis-filter-side">
            <div className="analysis-filter-group__label">显示控制</div>
            <Space direction="vertical" size={12}>
              <Space>
                <Switch checked={hideNoCombo} onChange={setHideNoCombo} />
                <Text>隐藏无组合的靶点</Text>
              </Space>
              <div className="analysis-filter-side__actions">
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
              </div>
              <div className="analysis-hint">
                当前按最高研发阶段排序，展示当前筛选条件下的全部靶点。
              </div>
            </Space>
          </div>
        </div>
      </Card>

      <MatrixBoard
        data={data}
        isLoading={isLoading}
        diseases={selectedDiseases}
        stages={selectedStages}
      />
    </div>
  )
}

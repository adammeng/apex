import { Button, Card, Space, Switch, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import PipelineBoard from '../../components/analysis/PipelineBoard'
import { DiseaseSingleSelect, TargetMultiSelect } from '../../components/analysis/filters'
import { pipelineApi } from '../../services/analysis'
import { metaApi } from '../../services/meta'
import '../analysis.css'

const { Title, Text } = Typography

export default function PipelinePage() {
  const initializedRef = useRef(false)
  const [selectedDisease, setSelectedDisease] = useState<string>()
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])
  const [includeCombo, setIncludeCombo] = useState(true)

  const { data: dictionaries, isLoading: dictionariesLoading } = useQuery({
    queryKey: ['analysis-dictionaries'],
    queryFn: metaApi.getDictionaries,
  })

  useEffect(() => {
    if (!dictionaries || initializedRef.current) {
      return
    }

    setSelectedDisease(dictionaries.diseases[0]?.name)
    initializedRef.current = true
  }, [dictionaries])

  const { data: targetData, isLoading: targetsLoading } = useQuery({
    queryKey: ['pipeline-targets', selectedDisease],
    queryFn: () => metaApi.getTargets(selectedDisease),
    enabled: !!selectedDisease,
  })

  useEffect(() => {
    if (!targetData) {
      return
    }
    setSelectedTargets(targetData.targets)
  }, [targetData])

  const targetGroups = useMemo(() => targetData?.groups ?? [], [targetData])
  const allTargets = useMemo(() => targetData?.targets ?? [], [targetData])
  const targetPayload = useMemo(() => {
    if (!targetData) {
      return undefined
    }
    if (selectedTargets.length === allTargets.length) {
      return undefined
    }
    return selectedTargets
  }, [allTargets.length, selectedTargets, targetData])

  const { data, isLoading } = useQuery({
    queryKey: ['pipeline-query', selectedDisease, targetPayload, includeCombo],
    queryFn: () =>
      pipelineApi.query({
        disease: selectedDisease as string,
        targets: targetPayload,
        include_combo: includeCombo,
      }),
    enabled: !!selectedDisease,
  })

  function handleReset() {
    if (!dictionaries?.diseases.length) {
      return
    }

    const firstDisease = dictionaries.diseases[0].name
    setSelectedDisease(firstDisease)
    setIncludeCombo(true)
  }

  return (
    <div className="analysis-page">
      <div className="analysis-page__hero">
        <div>
          <Title level={3}>靶点研发进展格局</Title>
          <p>
            聚焦单疾病下的靶点进展，把研发阶段显式折叠为 7 个固定泳道。靶点搜索只做前端模糊匹配，
            字典接口负责给出疾病列表和按字母分组的靶点选项。
          </p>
        </div>
        <div className="analysis-page__meta">
          {selectedDisease ? <Tag color="blue">{selectedDisease}</Tag> : null}
        </div>
      </div>

      <Card loading={dictionariesLoading}>
        <div className="analysis-filter-grid analysis-filter-grid--pipeline">
          <div className="analysis-filter-group">
            <div className="analysis-filter-group__label">疾病</div>
            <DiseaseSingleSelect
              options={dictionaries?.diseases ?? []}
              value={selectedDisease}
              onChange={setSelectedDisease}
            />
          </div>

          <div className="analysis-filter-group">
            <div className="analysis-filter-group__label">靶点</div>
            <TargetMultiSelect
              groups={targetGroups}
              value={selectedTargets}
              onChange={setSelectedTargets}
              disabled={targetsLoading || allTargets.length === 0}
            />
          </div>

          <div className="analysis-filter-side">
            <div className="analysis-filter-group__label">显示控制</div>
            <Space direction="vertical" size={12}>
              <Space>
                <Switch checked={includeCombo} onChange={setIncludeCombo} />
                <Text>包含组合靶点</Text>
              </Space>
              <div className="analysis-filter-side__actions">
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
              </div>
              <div className="analysis-hint">
                切换疾病后会重新加载该疾病下的靶点列表，并默认全选。
              </div>
            </Space>
          </div>
        </div>
      </Card>

      <PipelineBoard data={data} isLoading={isLoading} />
    </div>
  )
}

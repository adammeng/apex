import { Button, Card, Space, Switch, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import PipelineBoard from '../../components/analysis/PipelineBoard'
import { DiseaseSingleSelect, TargetMultiSelect } from '../../components/analysis/filters'
import { pipelineApi } from '../../services/analysis'
import { metaApi } from '../../services/meta'
import { useFilterStore } from '../../stores/filter'
import '../analysis.css'

const { Title, Text } = Typography

export default function PipelinePage() {
  const pipeline = useFilterStore((state) => state.pipeline)
  const setPipelineDisease = useFilterStore((state) => state.setPipelineDisease)
  const setPipelineTargets = useFilterStore((state) => state.setPipelineTargets)
  const setPipelineIncludeCombo = useFilterStore((state) => state.setPipelineIncludeCombo)
  const markPipelineTargetsHydrated = useFilterStore((state) => state.markPipelineTargetsHydrated)
  const resetPipeline = useFilterStore((state) => state.resetPipeline)

  const { data: dictionaries, isLoading: dictionariesLoading } = useQuery({
    queryKey: ['analysis-dictionaries'],
    queryFn: metaApi.getDictionaries,
  })

  useEffect(() => {
    if (!dictionaries?.diseases.length || pipeline.selectedDisease) {
      return
    }

    setPipelineDisease(dictionaries.diseases[0]?.name)
  }, [dictionaries, pipeline.selectedDisease, setPipelineDisease])

  const { data: targetData, isLoading: targetsLoading } = useQuery({
    queryKey: ['pipeline-targets', pipeline.selectedDisease],
    queryFn: () => metaApi.getTargets(pipeline.selectedDisease),
    enabled: !!pipeline.selectedDisease,
  })

  useEffect(() => {
    if (!targetData || !pipeline.selectedDisease) {
      return
    }

    const availableTargets = targetData.targets
    const nextSelectedTargets = pipeline.selectedTargets.filter((target) => availableTargets.includes(target))

    if (pipeline.targetsHydratedDisease === pipeline.selectedDisease) {
      if (nextSelectedTargets.length !== pipeline.selectedTargets.length) {
        setPipelineTargets(nextSelectedTargets)
      }
      return
    }

    if (nextSelectedTargets.length > 0) {
      setPipelineTargets(nextSelectedTargets)
    } else {
      setPipelineTargets(availableTargets)
    }

    markPipelineTargetsHydrated(pipeline.selectedDisease)
  }, [
    markPipelineTargetsHydrated,
    pipeline.selectedDisease,
    pipeline.selectedTargets,
    pipeline.targetsHydratedDisease,
    setPipelineTargets,
    targetData,
  ])

  const targetGroups = useMemo(() => targetData?.groups ?? [], [targetData])
  const allTargets = useMemo(() => targetData?.targets ?? [], [targetData])
  const targetPayload = useMemo(() => {
    if (!targetData) {
      return undefined
    }
    if (pipeline.selectedTargets.length === allTargets.length) {
      return undefined
    }
    return pipeline.selectedTargets
  }, [allTargets.length, pipeline.selectedTargets, targetData])

  const { data, isLoading } = useQuery({
    queryKey: ['pipeline-query', pipeline.selectedDisease, targetPayload, pipeline.includeCombo],
    queryFn: () =>
      pipelineApi.query({
        disease: pipeline.selectedDisease as string,
        targets: targetPayload,
        include_combo: pipeline.includeCombo,
      }),
    enabled: !!pipeline.selectedDisease,
  })

  function handleReset() {
    if (!dictionaries?.diseases.length) {
      return
    }

    const firstDisease = dictionaries.diseases[0].name
    resetPipeline({
      disease: firstDisease,
      targets: firstDisease === pipeline.selectedDisease ? allTargets : undefined,
    })
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
          {pipeline.selectedDisease ? <Tag color="blue">{pipeline.selectedDisease}</Tag> : null}
        </div>
      </div>

      <Card loading={dictionariesLoading}>
        <div className="analysis-filter-grid analysis-filter-grid--pipeline">
          <div className="analysis-filter-group">
            <div className="analysis-filter-group__label">疾病</div>
            <DiseaseSingleSelect
              options={dictionaries?.diseases ?? []}
              value={pipeline.selectedDisease}
              onChange={setPipelineDisease}
            />
          </div>

          <div className="analysis-filter-group">
            <div className="analysis-filter-group__label">靶点</div>
            <TargetMultiSelect
              groups={targetGroups}
              value={pipeline.selectedTargets}
              onChange={setPipelineTargets}
              disabled={targetsLoading || allTargets.length === 0}
            />
          </div>

          <div className="analysis-filter-side">
            <div className="analysis-filter-group__label">显示控制</div>
            <Space direction="vertical" size={12}>
              <Space>
                <Switch checked={pipeline.includeCombo} onChange={setPipelineIncludeCombo} />
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

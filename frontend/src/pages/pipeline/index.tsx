import { Button, Card, Space, Tag, Typography } from 'antd'
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import PipelineBoard from '../../components/analysis/PipelineBoard'
import { DiseaseSingleSelect, TargetMultiSelect } from '../../components/analysis/filters'
import { pipelineApi } from '../../services/analysis'
import { metaApi } from '../../services/meta'
import { useFilterStore } from '../../stores/filter'
import '../analysis.css'

const { Title } = Typography

export default function PipelinePage() {
  const pipeline = useFilterStore((state) => state.pipeline)
  const setPipelineDisease = useFilterStore((state) => state.setPipelineDisease)
  const setPipelineTargets = useFilterStore((state) => state.setPipelineTargets)
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
    queryKey: ['pipeline-query', pipeline.selectedDisease, targetPayload],
    queryFn: () =>
      pipelineApi.query({
        disease: pipeline.selectedDisease as string,
        targets: targetPayload,
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
        <div className="analysis-page__hero-left">
          <Title level={3}>靶点研发进展格局</Title>
          <p>聚焦单疾病下的靶点进展，把研发阶段折叠为 7 个固定泳道。</p>
        </div>
        <div className="analysis-page__meta">
          {pipeline.selectedDisease ? <Tag color="blue">{pipeline.selectedDisease}</Tag> : null}
        </div>
      </div>

      <Card loading={dictionariesLoading} className="analysis-filter-card">
        <div className="analysis-filter-bar">
          <FilterOutlined style={{ color: '#8494b0', flexShrink: 0 }} />

          <div className="analysis-filter-bar__item">
            <span className="analysis-filter-bar__label">疾病筛选</span>
            <DiseaseSingleSelect
              options={dictionaries?.diseases ?? []}
              value={pipeline.selectedDisease}
              onChange={setPipelineDisease}
            />
          </div>

          <div className="analysis-filter-bar__item">
            <span className="analysis-filter-bar__label">靶点筛选</span>
            <TargetMultiSelect
              groups={targetGroups}
              value={pipeline.selectedTargets}
              onChange={setPipelineTargets}
              disabled={targetsLoading || allTargets.length === 0}
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
        </div>
      </Card>

      <PipelineBoard data={data} isLoading={isLoading} />
    </div>
  )
}

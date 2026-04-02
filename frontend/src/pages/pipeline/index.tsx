import { Button, Space, Switch, Tag, Tooltip, Typography } from 'antd'
import { DownloadOutlined, FilterOutlined, FullscreenExitOutlined, FullscreenOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import PipelineBoard from '../../components/analysis/PipelineBoard'
import type { PipelineBoardHandle } from '../../components/analysis/PipelineBoard'
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

  const boardRef = useRef<PipelineBoardHandle>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const { data: dictionaries } = useQuery({
    queryKey: ['analysis-dictionaries'],
    queryFn: metaApi.getDictionaries,
  })

  useEffect(() => {
    if (!dictionaries?.diseases.length || pipeline.selectedDisease) return
    setPipelineDisease(dictionaries.diseases[0]?.name)
  }, [dictionaries, pipeline.selectedDisease, setPipelineDisease])

  const { data: targetData, isLoading: targetsLoading } = useQuery({
    queryKey: ['pipeline-targets', pipeline.selectedDisease],
    queryFn: () => metaApi.getTargets(pipeline.selectedDisease),
    enabled: !!pipeline.selectedDisease,
  })

  useEffect(() => {
    if (!targetData || !pipeline.selectedDisease) return

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
    if (!targetData) return undefined
    if (pipeline.selectedTargets.length === allTargets.length) return undefined
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
    if (!dictionaries?.diseases.length) return
    const firstDisease = dictionaries.diseases[0].name
    resetPipeline({
      disease: firstDisease,
      targets: firstDisease === pipeline.selectedDisease ? allTargets : undefined,
    })
  }

  function handleToggleFullscreen() {
    void boardRef.current?.toggleFullscreen().then(() => {
      setIsFullscreen(boardRef.current?.isFullscreen ?? false)
    })
  }

  return (
    <div className="analysis-page">
      <div className="analysis-page__hero">
        {/* 左：标题 */}
        <div className="analysis-page__hero-left">
          <Title level={5} style={{ margin: 0, whiteSpace: 'nowrap' }}>靶点研发进展格局</Title>
        </div>

        {/* 中：筛选栏 */}
        <div className="analysis-filter-bar analysis-filter-bar--inline">
          <FilterOutlined style={{ color: '#8494b0', flexShrink: 0 }} />

          <div className="analysis-filter-bar__item">
            <span className="analysis-filter-bar__label">疾病</span>
            <DiseaseSingleSelect
              options={dictionaries?.diseases ?? []}
              value={pipeline.selectedDisease}
              onChange={setPipelineDisease}
            />
          </div>

          <div className="analysis-filter-bar__item">
            <span className="analysis-filter-bar__label">靶点</span>
            <TargetMultiSelect
              groups={targetGroups}
              value={pipeline.selectedTargets}
              onChange={setPipelineTargets}
              disabled={targetsLoading || allTargets.length === 0}
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
        </div>

        {/* 右：靶点数 + 导出 + 全屏 */}
        <div className="analysis-page__meta">
          {pipeline.selectedDisease && (
            <Tag color="blue">{pipeline.selectedDisease}</Tag>
          )}
          <div className="analysis-filter-bar__divider" />
          <Tooltip title="导出当前泳道数据为 CSV">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              className="analysis-action-btn"
              onClick={() => boardRef.current?.exportCsv()}
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

      <PipelineBoard
        ref={boardRef}
        data={data}
        isLoading={isLoading}
      />
    </div>
  )
}

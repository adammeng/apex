import { Button, Empty, Spin, Tag, Tooltip } from 'antd'
import { FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons'
import React, { useRef } from 'react'
import type { PipelineQueryResult, TooltipDrug } from '../../services/analysis'
import { getDrugDisplayName, getScoreStyle } from './utils'
import { useBoardFullscreen } from './useBoardFullscreen'

interface PipelineBoardProps {
  data?: PipelineQueryResult
  isLoading: boolean
}

function PipelineDrugCard({ drug }: { drug: TooltipDrug }) {
  return (
    <div className="pipeline-card">
      <div className="pipeline-card__title">{getDrugDisplayName(drug)}</div>
      <div className="pipeline-card__meta">原研：{drug.originator || '-'}</div>
      <div className="pipeline-card__meta">机构：{drug.research_institute || '-'}</div>
      <div className="pipeline-card__meta">
        日期：{drug.highest_trial_date || '-'} · nctId：{drug.nct_id || '-'}
      </div>
      <div className="pipeline-card__footer">
        <Tag color="geekblue">
          {drug.stage_value} / {drug.score.toFixed(1)}
        </Tag>
        {drug.is_combo ? <Tag color="purple">组合</Tag> : null}
      </div>
    </div>
  )
}

export default function PipelineBoard({ data, isLoading }: PipelineBoardProps) {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const { isFullscreen, toggleFullscreen } = useBoardFullscreen(boardRef)

  if (isLoading) {
    return (
      <div className="analysis-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="analysis-empty">
        <Empty description="当前筛选条件下暂无研发进展数据" />
      </div>
    )
  }

  const laneCount = data.lanes.length

  return (
    <div ref={boardRef} className="analysis-board analysis-board--pipeline">
      <div className="analysis-board__toolbar">
        <Tooltip title={isFullscreen ? '退出全屏' : '全屏查看'}>
          <Button
            size="small"
            icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? '退出全屏' : '全屏'}
          </Button>
        </Tooltip>
      </div>
      <div className="pipeline-scroll">
        <table className="pipeline-table" style={{ '--pipeline-lane-count': laneCount } as React.CSSProperties}>
          <thead>
            <tr>
              <th className="pipeline-th pipeline-th--target">Target</th>
              {data.lanes.map((lane) => (
                <th key={lane} className="pipeline-th pipeline-th--lane">
                  {lane}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.target} className="pipeline-tr">
                <td className="pipeline-td pipeline-td--target">
                  <div className="pipeline-td__target-inner">
                    <div className="pipeline-row__target-name">{row.target}</div>
                    <Tag color="blue">{row.total_drug_count}</Tag>
                    <span className="pipeline-row__target-score" style={getScoreStyle(row.max_score)}>
                      {row.max_score.toFixed(1)}
                    </span>
                  </div>
                </td>
                {data.lanes.map((lane, index) => (
                  <td
                    key={`${row.target}-${lane}`}
                    className={`pipeline-td pipeline-td--lane ${index % 2 === 1 ? 'pipeline-td--alt' : ''}`}
                  >
                    {(row.cells[lane] || []).map((drug) => (
                      <PipelineDrugCard
                        key={`${row.target}-${lane}-${drug.drug_id}-${drug.nct_id}`}
                        drug={drug}
                      />
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

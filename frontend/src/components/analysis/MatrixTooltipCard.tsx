import { Empty, Spin } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { matrixApi } from '../../services/analysis'
import { getDrugDisplayName } from './utils'

interface MatrixTooltipCardProps {
  rowTarget: string
  colTarget: string
  diseases?: string[]
  stages?: string[]
}

export default function MatrixTooltipCard({
  rowTarget,
  colTarget,
  diseases,
  stages
}: MatrixTooltipCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['matrix-tooltip', rowTarget, colTarget, diseases, stages],
    queryFn: () =>
      matrixApi.tooltip({
        row_target: rowTarget,
        col_target: colTarget,
        diseases,
        stages,
      }),
  })

  if (isLoading) {
    return (
      <div className="matrix-tooltip-card matrix-tooltip-card--loading">
        <Spin size="small" />
      </div>
    )
  }

  if (!data || data.drugs.length === 0) {
    return (
      <div className="matrix-tooltip-card">
        <div className="matrix-tooltip-card__scroll">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
        </div>
      </div>
    )
  }

  const title = rowTarget === colTarget ? rowTarget : `${rowTarget} + ${colTarget}`
  const subtitle = rowTarget === colTarget
    ? '单靶点最高阶段明细'
    : '组合竞争明细'

  return (
    <div className="matrix-tooltip-card">
      <div className="matrix-tooltip-card__header">
        <div>
          <div className="matrix-tooltip-card__title">{title}</div>
          <div className="matrix-tooltip-card__subtitle">{subtitle}</div>
        </div>
        <span className="matrix-tooltip-card__count">{data.drugs.length} 条</span>
      </div>

      <div className="matrix-tooltip-card__scroll">
        <div className="matrix-tooltip-card__list">
          {data.drugs.map((drug, index) => (
            <div
              key={`${drug.drug_id}-${drug.nct_id}-${drug.disease}-${drug.stage_value}-${index}`}
              className="matrix-tooltip-card__item"
            >
              <div className="matrix-tooltip-card__item-top">
                <span className="matrix-tooltip-card__item-name">{getDrugDisplayName(drug)}</span>
                <span className="matrix-tooltip-card__item-tag">
                  {drug.stage_value} / {drug.score.toFixed(1)}
                </span>
              </div>
              <div className="matrix-tooltip-card__item-meta">
                <span className="matrix-tooltip-card__item-label">疾病</span>
                <span className="matrix-tooltip-card__item-value">{drug.disease}</span>
                <span className="matrix-tooltip-card__item-label">原研</span>
                <span className="matrix-tooltip-card__item-value">{drug.originator || '-'}</span>
                <span className="matrix-tooltip-card__item-label">机构</span>
                <span className="matrix-tooltip-card__item-value">{drug.research_institute || '-'}</span>
                <span className="matrix-tooltip-card__item-label">日期</span>
                <span className="matrix-tooltip-card__item-value">
                  {drug.highest_trial_date || '-'}
                  {drug.nct_id ? <span style={{ color: '#9aaabe' }}> · {drug.nct_id}</span> : null}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

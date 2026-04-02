import { Button, Empty, Spin, Tooltip } from 'antd'
import { DownloadOutlined, FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons'
import { useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { MatrixCell, MatrixQueryResult } from '../../services/analysis'
import MatrixTooltipCard from './MatrixTooltipCard'
import { buildCsv, downloadCsv, getCellKey, getScoreStyle } from './utils'
import { useBoardFullscreen } from './useBoardFullscreen'

interface MatrixBoardProps {
  data?: MatrixQueryResult
  isLoading: boolean
  diseases?: string[]
  stages?: string[]
}

interface TooltipState {
  rowTarget: string
  colTarget: string
  left: number
  top: number
}

export default function MatrixBoard({
  data,
  isLoading,
  diseases,
  stages,
}: MatrixBoardProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const { isFullscreen, toggleFullscreen } = useBoardFullscreen(boardRef)

  const cellMap = useMemo(() => {
    const map = new Map<string, MatrixCell>()
    data?.cells.forEach((cell) => {
      map.set(getCellKey(cell.row_target, cell.col_target), cell)
    })
    return map
  }, [data])

  function handleExport() {
    if (!data) return
    const header = ['靶点（行）', '最高阶段分', ...data.targets]
    const rows: string[][] = [header]
    for (const rowTarget of data.targets) {
      const singleScore = data.single_max[rowTarget]?.score
      const row: string[] = [
        rowTarget,
        singleScore != null ? singleScore.toFixed(1) : '',
        ...data.targets.map((colTarget) => {
          if (rowTarget === colTarget) return '-'
          const cell = cellMap.get(getCellKey(rowTarget, colTarget))
          return cell?.score != null ? cell.score.toFixed(1) : ''
        }),
      ]
      rows.push(row)
    }
    downloadCsv('靶点组合竞争矩阵.csv', buildCsv(rows))
  }

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  function scheduleCloseTooltip() {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => setTooltip(null), 120)
  }

  function openTooltip(
    event: ReactMouseEvent<HTMLElement>,
    rowTarget: string,
    colTarget: string
  ) {
    clearCloseTimer()
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltip({
      rowTarget,
      colTarget,
      left: Math.min(rect.right + 12, window.innerWidth - 420),
      top: Math.min(rect.top, window.innerHeight - 460),
    })
  }

  if (isLoading) {
    return (
      <div className="analysis-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (!data || data.targets.length === 0) {
    return (
      <div className="analysis-empty">
        <Empty description="当前筛选条件下暂无矩阵数据" />
      </div>
    )
  }

  return (
    <div ref={boardRef} className="analysis-board analysis-board--matrix">
      <div className="analysis-board__toolbar">
        <Tooltip title="导出当前矩阵为 CSV">
          <Button size="small" icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Tooltip>
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
      <div className="matrix-scroll">
        <table className="matrix-table">
          <colgroup>
            <col className="matrix-col--main" />
            <col className="matrix-col--phase" />
            {data.targets.map((target) => (
              <col key={`col-${target}`} className="matrix-col--cell" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="matrix-table__corner">Target</th>
              <th className="matrix-table__subcorner">Highest Phase</th>
              {data.targets.map((target) => (
                <th key={`col-${target}`} className="matrix-table__header">
                  {target}
                </th>
              ))}
            </tr>
            <tr>
              <th className="matrix-table__corner matrix-table__corner--secondary">Highest Phase</th>
              <th className="matrix-table__subcorner matrix-table__subcorner--secondary">-</th>
              {data.targets.map((target) => {
                const score = data.single_max[target]?.score
                const style = getScoreStyle(score)
                return (
                  <th
                    key={`score-${target}`}
                    className="matrix-table__score matrix-table__score--header"
                    style={style}
                    onMouseEnter={(event) => openTooltip(event, target, target)}
                    onMouseLeave={scheduleCloseTooltip}
                  >
                    {score ? score.toFixed(1) : '-'}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {data.targets.map((rowTarget) => (
              <tr key={rowTarget}>
                <th className="matrix-table__row-header">{rowTarget}</th>
                <th
                  className="matrix-table__score matrix-table__score--side"
                  style={getScoreStyle(data.single_max[rowTarget]?.score)}
                  onMouseEnter={(event) => openTooltip(event, rowTarget, rowTarget)}
                  onMouseLeave={scheduleCloseTooltip}
                >
                  {data.single_max[rowTarget]?.score?.toFixed(1) || '-'}
                </th>
                {data.targets.map((colTarget) => {
                  if (rowTarget === colTarget) {
                    return <td key={`${rowTarget}-${colTarget}`} className="matrix-table__diagonal" />
                  }

                  const cell = cellMap.get(getCellKey(rowTarget, colTarget))
                  const score = cell?.score
                  const style = getScoreStyle(score, !cell)
                  return (
                    <td
                      key={`${rowTarget}-${colTarget}`}
                      className="matrix-table__cell"
                      style={style}
                      onMouseEnter={(event) => {
                        if (!cell) return
                        openTooltip(event, rowTarget, colTarget)
                      }}
                      onMouseLeave={scheduleCloseTooltip}
                    >
                      {score ? score.toFixed(1) : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="analysis-legend">
        {data.legend.map((item) => (
          <div key={item.value} className="analysis-legend__item">
            <span className="analysis-legend__swatch" style={getScoreStyle(item.score)} />
            <span>
              {item.matrix} ({item.score.toFixed(1)})
            </span>
          </div>
        ))}
      </div>

      {tooltip ? (
        <div
          className="matrix-tooltip"
          style={{ left: tooltip.left, top: tooltip.top }}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleCloseTooltip}
        >
          <MatrixTooltipCard
            rowTarget={tooltip.rowTarget}
            colTarget={tooltip.colTarget}
            diseases={diseases}
            stages={stages}
          />
        </div>
      ) : null}
    </div>
  )
}

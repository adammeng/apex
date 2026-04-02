import { Empty, Spin } from 'antd'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { MatrixCell, MatrixQueryResult } from '../../services/analysis'
import MatrixTooltipCard from './MatrixTooltipCard'
import { buildCsv, downloadCsv, getCellKey, getScoreStyle } from './utils'
import { useBoardFullscreen } from './useBoardFullscreen'

// ── 尺寸常量 ────────────────────────────────────────────────────────────────
const ROW_H = 48           // 每行高度 px（数据行）
const HEADER_H = 96        // 列头区域总高度（两行各 48px）
const COL_TARGET_W = 180   // 行头"Target"列宽 px
const COL_PHASE_W = 118    // 行头"Phase score"列宽 px
const COL_W = 118          // 数据列宽 px
const FIXED_W = COL_TARGET_W + COL_PHASE_W  // 左侧两固定列总宽

export interface MatrixBoardHandle {
  isFullscreen: boolean
  toggleFullscreen: () => Promise<void>
  exportCsv: () => void
}

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

const MatrixBoard = forwardRef<MatrixBoardHandle, MatrixBoardProps>(function MatrixBoard({
  data,
  isLoading,
  diseases,
  stages,
}, ref) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const { isFullscreen, toggleFullscreen } = useBoardFullscreen(boardRef)

  // ── 四个独立 ref，通过 scroll 事件相互同步 ──────────────────────────────
  // colHeaderRef: 顶部列头区域（仅水平滚动同步）
  // rowHeaderRef: 左侧行头区域（仅垂直滚动同步）
  // dataRef:      数据区（主滚动区）
  const colHeaderRef = useRef<HTMLDivElement | null>(null)
  const rowHeaderRef = useRef<HTMLDivElement | null>(null)
  const dataRef = useRef<HTMLDivElement | null>(null)
  const syncingRef = useRef(false)  // 防止 scroll 事件循环触发

  const cellMap = useMemo(() => {
    const map = new Map<string, MatrixCell>()
    data?.cells.forEach((cell) => {
      map.set(getCellKey(cell.row_target, cell.col_target), cell)
    })
    return map
  }, [data])

  const targets = data?.targets ?? []
  const rowCount = targets.length
  const colCount = targets.length
  const totalDataW = colCount * COL_W   // 数据区内容总宽度
  const totalDataH = rowCount * ROW_H   // 数据区内容总高度

  // ── 导出 ─────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!data) return
    const header = ['靶点（行）', '最高阶段分', ...targets]
    const rows: string[][] = [header]
    for (const rowTarget of targets) {
      const singleScore = data.single_max[rowTarget]?.score
      const row: string[] = [
        rowTarget,
        singleScore != null ? singleScore.toFixed(1) : '',
        ...targets.map((colTarget) => {
          if (rowTarget === colTarget) return '-'
          const cell = cellMap.get(getCellKey(rowTarget, colTarget))
          return cell?.score != null ? cell.score.toFixed(1) : ''
        }),
      ]
      rows.push(row)
    }
    downloadCsv('靶点组合竞争矩阵.csv', buildCsv(rows))
  }, [data, targets, cellMap])

  useImperativeHandle(ref, () => ({
    isFullscreen,
    toggleFullscreen,
    exportCsv: handleExport,
  }), [isFullscreen, toggleFullscreen, handleExport])

  // ── 行虚拟化（数据区垂直方向） ───────────────────────────────────────────
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => dataRef.current,
    estimateSize: () => ROW_H,
    overscan: 8,
  })

  // ── 列虚拟化（数据区水平方向） ───────────────────────────────────────────
  const colVirtualizer = useVirtualizer({
    count: colCount,
    horizontal: true,
    getScrollElement: () => dataRef.current,
    estimateSize: () => COL_W,
    overscan: 4,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const virtualCols = colVirtualizer.getVirtualItems()

  // ── scroll 同步逻辑 ───────────────────────────────────────────────────────
  const onDataScroll = useCallback(() => {
    if (syncingRef.current) return
    const el = dataRef.current
    if (!el) return
    syncingRef.current = true
    if (colHeaderRef.current) colHeaderRef.current.scrollLeft = el.scrollLeft
    if (rowHeaderRef.current) rowHeaderRef.current.scrollTop = el.scrollTop
    syncingRef.current = false
  }, [])

  useEffect(() => {
    const el = dataRef.current
    if (!el) return
    el.addEventListener('scroll', onDataScroll, { passive: true })
    return () => el.removeEventListener('scroll', onDataScroll)
  }, [onDataScroll, targets])  // targets 变化时重绑（数据更新后 ref 依然存在）

  // ── Tooltip ───────────────────────────────────────────────────────────────
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

  const openTooltip = useCallback(
    (el: HTMLElement, rowTarget: string, colTarget: string) => {
      clearCloseTimer()
      const rect = el.getBoundingClientRect()
      setTooltip({
        rowTarget,
        colTarget,
        left: Math.min(rect.right + 12, window.innerWidth - 420),
        top: Math.min(rect.top, window.innerHeight - 460),
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // ── Early returns ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="analysis-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (!data || targets.length === 0) {
    return (
      <div className="analysis-empty">
        <Empty description="当前筛选条件下暂无矩阵数据" />
      </div>
    )
  }

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  return (
    <div ref={boardRef} className="analysis-board analysis-board--matrix">

      {/*
        ┌─────────────────────────────────────────────────────────────┐
        │  vm-grid                                                    │
        │  ┌──────────────┬──────────────────────────────────────────┐│
        │  │  vm-corner   │  vm-col-header (overflow hidden, sync ←→)││
        │  ├──────────────┼──────────────────────────────────────────┤│
        │  │  vm-row-     │  vm-data (主滚动区，overflow auto)       ││
        │  │  header      │                                          ││
        │  │ (overflow    │                                          ││
        │  │  hidden,     │                                          ││
        │  │  sync ↑↓)   │                                          ││
        │  └──────────────┴──────────────────────────────────────────┘│
        └─────────────────────────────────────────────────────────────┘
      */}
      <div className="vm-grid">

        {/* ── 左上角（Corner）── */}
        <div className="vm-corner" style={{ width: FIXED_W, height: HEADER_H }}>
          {/* 上半行：Target / (空) */}
          <div className="vm-corner__row" style={{ height: HEADER_H / 2 }}>
            <div className="vm-corner__cell" style={{ width: COL_TARGET_W }}>Target</div>
            <div className="vm-corner__cell" style={{ width: COL_PHASE_W }}>Highest Phase</div>
          </div>
          {/* 下半行：Highest Phase / — */}
          <div className="vm-corner__row" style={{ height: HEADER_H / 2 }}>
            <div className="vm-corner__cell" style={{ width: COL_TARGET_W }}>Highest Phase</div>
            <div className="vm-corner__cell" style={{ width: COL_PHASE_W }}>—</div>
          </div>
        </div>

        {/* ── 顶部列头（水平随 dataRef 同步，不显示 scrollbar） ── */}
        <div
          ref={colHeaderRef}
          className="vm-col-header"
          style={{ height: HEADER_H }}
        >
          {/* 撑开内容宽度 */}
          <div style={{ width: totalDataW, height: HEADER_H, position: 'relative' }}>
            {/* 第一行：靶点名 */}
            {virtualCols.map((vc) => {
              const target = targets[vc.index]
              return (
                <div
                  key={`ch1-${vc.index}`}
                  className="vm-col-header__cell vm-col-header__cell--name"
                  style={{
                    position: 'absolute',
                    left: vc.start,
                    top: 0,
                    width: vc.size,
                    height: HEADER_H / 2,
                  }}
                  title={target}
                >
                  {target}
                </div>
              )
            })}
            {/* 第二行：score */}
            {virtualCols.map((vc) => {
              const target = targets[vc.index]
              const score = data.single_max[target]?.score
              const scoreStyle = getScoreStyle(score)
              return (
                <div
                  key={`ch2-${vc.index}`}
                  className="vm-col-header__cell vm-col-header__cell--score"
                  style={{
                    position: 'absolute',
                    left: vc.start,
                    top: HEADER_H / 2,
                    width: vc.size,
                    height: HEADER_H / 2,
                    ...scoreStyle,
                  }}
                  onMouseEnter={(e) => openTooltip(e.currentTarget, target, target)}
                  onMouseLeave={scheduleCloseTooltip}
                >
                  {score ? score.toFixed(1) : '—'}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 左侧行头（垂直随 dataRef 同步，不显示 scrollbar） ── */}
        <div
          ref={rowHeaderRef}
          className="vm-row-header-col"
          style={{ width: FIXED_W }}
        >
          {/* 撑开内容高度 */}
          <div style={{ height: totalDataH, position: 'relative' }}>
            {virtualRows.map((vr) => {
              const rowTarget = targets[vr.index]
              const singleScore = data.single_max[rowTarget]?.score
              return (
                <div
                  key={`rh-${vr.index}`}
                  style={{
                    position: 'absolute',
                    top: vr.start,
                    left: 0,
                    width: FIXED_W,
                    height: ROW_H,
                    display: 'flex',
                  }}
                >
                  <div
                    className="vm-row-header"
                    style={{ width: COL_TARGET_W, height: ROW_H }}
                    title={rowTarget}
                  >
                    {rowTarget}
                  </div>
                  <div
                    className="vm-row-phase"
                    style={{
                      width: COL_PHASE_W,
                      height: ROW_H,
                      ...getScoreStyle(singleScore),
                    }}
                    onMouseEnter={(e) => openTooltip(e.currentTarget, rowTarget, rowTarget)}
                    onMouseLeave={scheduleCloseTooltip}
                  >
                    {singleScore ? singleScore.toFixed(1) : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 数据区（主滚动区） ── */}
        <div ref={dataRef} className="vm-data">
          {/* 撑开真实尺寸 */}
          <div style={{ width: totalDataW, height: totalDataH, position: 'relative' }}>
            {virtualRows.map((vr) => {
              const rowTarget = targets[vr.index]
              return virtualCols.map((vc) => {
                const colTarget = targets[vc.index]
                const isDiag = rowTarget === colTarget
                const cell = isDiag ? undefined : cellMap.get(getCellKey(rowTarget, colTarget))
                const score = cell?.score
                const cellStyle = getScoreStyle(score, isDiag || !cell)

                return (
                  <div
                    key={`c-${vr.index}-${vc.index}`}
                    className={`vm-cell${isDiag ? ' vm-cell--diagonal' : ''}`}
                    style={{
                      position: 'absolute',
                      top: vr.start,
                      left: vc.start,
                      width: vc.size,
                      height: ROW_H,
                      ...cellStyle,
                    }}
                    onMouseEnter={(e) => {
                      if (isDiag || !cell) return
                      openTooltip(e.currentTarget, rowTarget, colTarget)
                    }}
                    onMouseLeave={scheduleCloseTooltip}
                  >
                    {score ? score.toFixed(1) : ''}
                  </div>
                )
              })
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
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

      {/* Tooltip */}
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
})

export default MatrixBoard

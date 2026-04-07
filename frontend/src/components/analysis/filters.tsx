import { Checkbox, Select, TreeSelect } from 'antd'
import type { DefaultOptionType } from 'antd/es/select'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiseaseOption, DiseaseTree, StageItem, TargetGroup } from '../../services/meta'

interface DiseaseTreeFilterProps {
  diseaseTree: DiseaseTree[]
  value: string[]
  onChange: (value: string[]) => void
}

interface StageFilterProps {
  stages: StageItem[]
  value: string[]
  onChange: (value: string[]) => void
}

interface DiseaseSingleSelectProps {
  options: DiseaseOption[]
  value?: string
  onChange: (value: string) => void
}

interface TargetMultiSelectProps {
  groups: TargetGroup[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}

// 统一触发器宽度
const FILTER_WIDTH = 200

function EllipsisOptionLabel({ text }: { text: string }) {
  return (
    <span className="filter-option-label filter-tree-label" title={text}>
      {text}
    </span>
  )
}

function SelectAllRow({
  allCount,
  selectedCount,
  onSelectAll,
  onClear,
}: {
  allCount: number
  selectedCount: number
  onSelectAll: () => void
  onClear: () => void
}) {
  const allSelected = selectedCount === allCount && allCount > 0
  const indeterminate = selectedCount > 0 && selectedCount < allCount

  return (
    <div className="filter-select-all-row">
      <Checkbox
        indeterminate={indeterminate}
        checked={allSelected}
        onChange={() => (allSelected ? onClear() : onSelectAll())}
      >
        {allSelected ? '取消全选' : '全选'}
      </Checkbox>
    </div>
  )
}

// ── DiseaseTreeFilter ─────────────────────────────────────────────────────────

function triggerLabel(selectedCount: number, allCount: number, allText = '已全选'): string {
  if (allCount === 0) return '加载中…'
  if (selectedCount === allCount) return allText
  if (selectedCount === 0) return '未选择'
  return `已选 ${selectedCount} 项`
}

// ── trigger 显示文本 ──────────────────────────────────────────────────────────

export function DiseaseTreeFilter({ diseaseTree, value, onChange }: DiseaseTreeFilterProps) {
  const allDiseases = useMemo(
    () => diseaseTree.flatMap((area) => area.children.map((child) => child.name)),
    [diseaseTree]
  )

  const treeData = useMemo(
    () =>
      diseaseTree.map((area) => ({
        title: <EllipsisOptionLabel text={area.ta} />,
        value: `ta::${area.ta}`,
        selectable: false,
        searchText: area.ta,
        children: area.children.map((child) => ({
          title: <EllipsisOptionLabel text={child.name} />,
          value: child.name,
          searchText: `${area.ta} ${child.name}`,
        })),
      })),
    [diseaseTree]
  )

  const label = triggerLabel(value.length, allDiseases.length)

  return (
    <TreeSelect
      treeCheckable
      showSearch
      allowClear={false}
      maxTagCount={0}
      maxTagPlaceholder={() => label}
      value={value}
      treeData={treeData}
      treeNodeFilterProp="searchText"
      placeholder="选择疾病"
      style={{ width: FILTER_WIDTH }}
      popupMatchSelectWidth={false}
      popupClassName="disease-tree-dropdown"
      styles={{
        popup: {
          root: {
            maxHeight: 420,
            overflow: 'auto',
          },
        },
      }}
      popupRender={(menu) => (
        <>
          <SelectAllRow
            allCount={allDiseases.length}
            selectedCount={value.length}
            onSelectAll={() => onChange(allDiseases)}
            onClear={() => onChange([])}
          />
          {menu}
        </>
      )}
      onChange={(nextValue) => {
        const selected = (nextValue as string[]).filter((item) => allDiseases.includes(item))
        onChange(selected)
      }}
    />
  )
}

// ── StageFilter ───────────────────────────────────────────────────────────────

export function StageFilter({ stages, value, onChange }: StageFilterProps) {
  const options = useMemo(
    () =>
      stages.map((stage) => ({
        label: stage.matrix,
        value: stage.value,
      })),
    [stages]
  )

  const allValues = useMemo(() => stages.map((stage) => stage.value), [stages])
  const label = triggerLabel(value.length, allValues.length, '全部阶段')

  return (
    <Select
      mode="multiple"
      allowClear={false}
      maxTagCount={0}
      maxTagPlaceholder={() => label}
      placeholder="选择阶段"
      style={{ width: FILTER_WIDTH }}
      options={options}
      value={value}
      optionFilterProp="label"
      onChange={onChange}
      popupRender={(menu) => (
        <>
          <SelectAllRow
            allCount={allValues.length}
            selectedCount={value.length}
            onSelectAll={() => onChange(allValues)}
            onClear={() => onChange([])}
          />
          {menu}
        </>
      )}
    />
  )
}

// ── DiseaseSingleSelect ───────────────────────────────────────────────────────

export function DiseaseSingleSelect({
  options,
  value,
  onChange,
}: DiseaseSingleSelectProps) {
  const [searchValue, setSearchValue] = useState('')
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null)
  const popupBodyRef = useRef<HTMLDivElement | null>(null)

  // 按 ta 分组，构造 grouped options
  const groups = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const item of options) {
      const key = item.ta || '其他'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item.name)
    }
    return Array.from(map.entries()).map(([key, diseases]) => ({ key, diseases }))
  }, [options])

  const groupedOptions = useMemo<DefaultOptionType[]>(
    () =>
      groups.map((group) => ({
        label: (
          <span className="filter-option-group-label" data-disease-group={group.key}>
            {group.key}
          </span>
        ),
        options: group.diseases.map((name) => ({
          label: name,
          filterLabel: `${name} ${group.key}`,
          plainLabel: name,
          value: name,
        })),
      })),
    [groups]
  )

  const visibleGroupKeys = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) return groups.map((g) => g.key)
    return groups
      .filter((g) => g.diseases.some((d) => d.toLowerCase().includes(keyword)) || g.key.toLowerCase().includes(keyword))
      .map((g) => g.key)
  }, [groups, searchValue])

  useEffect(() => {
    setActiveGroupKey(visibleGroupKeys[0] ?? null)
  }, [visibleGroupKeys])

  useEffect(() => {
    const popupBody = popupBodyRef.current
    if (!popupBody) return

    const scrollContainer =
      popupBody.querySelector<HTMLElement>('.rc-virtual-list-holder') ?? popupBody

    const handleScroll = () => {
      const anchors = Array.from(
        popupBody.querySelectorAll<HTMLElement>('[data-disease-group]')
      )
      if (anchors.length === 0) return
      const containerTop = scrollContainer.getBoundingClientRect().top
      const current = anchors.find(
        (anchor) => anchor.getBoundingClientRect().bottom >= containerTop + 8
      )
      if (current?.dataset.diseaseGroup) {
        setActiveGroupKey(current.dataset.diseaseGroup)
      }
    }

    handleScroll()
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [groups, searchValue])

  function scrollToGroup(groupKey: string) {
    setActiveGroupKey(groupKey)
    const anchor = popupBodyRef.current?.querySelector<HTMLElement>(
      `[data-disease-group="${groupKey}"]`
    )
    anchor?.scrollIntoView({ block: 'start' })
  }

  return (
    <Select
      showSearch
      virtual={false}
      value={value}
      placeholder="请选择疾病"
      style={{ width: FILTER_WIDTH }}
      popupMatchSelectWidth={false}
      listHeight={360}
      options={groupedOptions}
      filterOption={(input, option) =>
        String((option as DefaultOptionType & { filterLabel?: string })?.filterLabel ?? '')
          .toLowerCase()
          .includes(input.toLowerCase())
      }
      optionRender={(option) => <EllipsisOptionLabel text={String(option.data.plainLabel ?? '')} />}
      onSearch={setSearchValue}
      onChange={onChange}
      popupRender={(menu) => (
        <div className="target-select-dropdown">
          <div className="target-select-dropdown__body">
            <div ref={popupBodyRef} className="target-select-dropdown__menu">
              {menu}
            </div>
            <div className="target-select-dropdown__index" aria-label="疾病分组索引">
              {visibleGroupKeys.map((groupKey) => {
                // 取首字母或首个汉字作为索引标签
                const label = groupKey.charAt(0).toUpperCase()
                return (
                  <button
                    key={groupKey}
                    type="button"
                    title={groupKey}
                    className={`target-select-dropdown__index-item${activeGroupKey === groupKey ? ' is-active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => scrollToGroup(groupKey)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    />
  )
}

// ── TargetMultiSelect ─────────────────────────────────────────────────────────

export function TargetMultiSelect({
  groups,
  value,
  onChange,
  disabled,
}: TargetMultiSelectProps) {
  const [searchValue, setSearchValue] = useState('')
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null)
  const popupBodyRef = useRef<HTMLDivElement | null>(null)

  const options = useMemo<DefaultOptionType[]>(
    () =>
      groups.map((group) => ({
        label: (
          <span className="filter-option-group-label" data-target-group={group.key}>
            {group.key}
          </span>
        ),
        options: group.targets.map((target) => ({
          label: target,
          plainLabel: target,
          value: target,
        })),
      })),
    [groups]
  )

  const allTargets = useMemo(() => groups.flatMap((group) => group.targets), [groups])
  const visibleGroupKeys = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) {
      return groups.map((group) => group.key)
    }

    return groups
      .filter((group) =>
        group.targets.some((target) => target.toLowerCase().includes(keyword))
      )
      .map((group) => group.key)
  }, [groups, searchValue])
  const label = triggerLabel(value.length, allTargets.length)

  useEffect(() => {
    setActiveGroupKey(visibleGroupKeys[0] ?? null)
  }, [visibleGroupKeys])

  useEffect(() => {
    const popupBody = popupBodyRef.current
    if (!popupBody) return

    const scrollContainer =
      popupBody.querySelector<HTMLElement>('.rc-virtual-list-holder') ?? popupBody

    const handleScroll = () => {
      const anchors = Array.from(
        popupBody.querySelectorAll<HTMLElement>('[data-target-group]')
      )
      if (anchors.length === 0) return

      const containerTop = scrollContainer.getBoundingClientRect().top
      const currentAnchor = anchors.find(
        (anchor) => anchor.getBoundingClientRect().bottom >= containerTop + 8
      )
      if (currentAnchor?.dataset.targetGroup) {
        setActiveGroupKey(currentAnchor.dataset.targetGroup)
      }
    }

    handleScroll()
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [groups, searchValue])

  function scrollToGroup(groupKey: string) {
    setActiveGroupKey(groupKey)
    const popupBody = popupBodyRef.current
    const anchor = popupBody?.querySelector<HTMLElement>(`[data-target-group="${groupKey}"]`)
    anchor?.scrollIntoView({ block: 'start' })
  }

  return (
    <Select
      mode="multiple"
      allowClear={false}
      maxTagCount={0}
      maxTagPlaceholder={() => label}
      showSearch
      disabled={disabled}
      value={value}
      placeholder="请选择靶点"
      style={{ width: FILTER_WIDTH }}
      virtual={false}
      popupMatchSelectWidth={false}
      listHeight={360}
      options={options}
      filterOption={(input, option) =>
        String((option as DefaultOptionType & { plainLabel?: string })?.plainLabel ?? '')
          .toLowerCase()
          .includes(input.toLowerCase())
      }
      optionRender={(option) => <EllipsisOptionLabel text={String(option.data.plainLabel ?? '')} />}
      onSearch={setSearchValue}
      onChange={onChange}
      popupRender={(menu) => (
        <div className="target-select-dropdown">
          <SelectAllRow
            allCount={allTargets.length}
            selectedCount={value.length}
            onSelectAll={() => onChange(allTargets)}
            onClear={() => onChange([])}
          />
          <div className="target-select-dropdown__body">
            <div ref={popupBodyRef} className="target-select-dropdown__menu">
              {menu}
            </div>
            <div className="target-select-dropdown__index" aria-label="靶点字母索引">
              {visibleGroupKeys.map((groupKey) => (
                <button
                  key={groupKey}
                  type="button"
                  className={`target-select-dropdown__index-item${activeGroupKey === groupKey ? ' is-active' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => scrollToGroup(groupKey)}
                >
                  {groupKey}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    />
  )
}

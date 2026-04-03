import { Checkbox, Select, TreeSelect } from 'antd'
import type { DefaultOptionType } from 'antd/es/select'
import { useMemo } from 'react'
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
        title: area.ta,
        value: `ta::${area.ta}`,
        selectable: false,
        searchText: area.ta,
        children: area.children.map((child) => ({
          title: child.name,
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
      styles={{
        popup: {
          root: {
            maxHeight: 420,
            overflow: 'auto',
            minWidth: 320,
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
  const selectOptions = useMemo(
    () =>
      options.map((item) => ({
        label: `${item.name}`,
        filterLabel: `${item.name} ${item.ta}`,
        value: item.name,
      })),
    [options]
  )

  return (
    <Select
      showSearch
      value={value}
      placeholder="请选择疾病"
      style={{ width: FILTER_WIDTH }}
      options={selectOptions}
      optionFilterProp="filterLabel"
      onChange={onChange}
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
  const options = useMemo<DefaultOptionType[]>(
    () =>
      groups.map((group) => ({
        label: group.key,
        options: group.targets.map((target) => ({
          label: target,
          value: target,
        })),
      })),
    [groups]
  )

  const allTargets = useMemo(() => groups.flatMap((group) => group.targets), [groups])
  const label = triggerLabel(value.length, allTargets.length)

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
      options={options}
      optionFilterProp="label"
      onChange={onChange}
      popupRender={(menu) => (
        <>
          <SelectAllRow
            allCount={allTargets.length}
            selectedCount={value.length}
            onSelectAll={() => onChange(allTargets)}
            onClear={() => onChange([])}
          />
          {menu}
        </>
      )}
    />
  )
}

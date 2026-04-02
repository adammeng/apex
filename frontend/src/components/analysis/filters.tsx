import { Button, Select, Space, Tooltip, TreeSelect } from 'antd'
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

function renderLabel(label: string) {
  return (
    <Tooltip title={label}>
      <span className="analysis-ellipsis">{label}</span>
    </Tooltip>
  )
}

export function DiseaseTreeFilter({ diseaseTree, value, onChange }: DiseaseTreeFilterProps) {
  const allDiseases = useMemo(
    () => diseaseTree.flatMap((area) => area.children.map((child) => child.name)),
    [diseaseTree]
  )

  const treeData = useMemo(
    () =>
      diseaseTree.map((area) => ({
        title: renderLabel(area.ta),
        value: `ta::${area.ta}`,
        selectable: false,
        searchText: area.ta,
        children: area.children.map((child) => ({
          title: renderLabel(child.name),
          value: child.name,
          searchText: `${area.ta} ${child.name}`
        }))
      })),
    [diseaseTree]
  )

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <TreeSelect
        treeCheckable
        showSearch
        allowClear
        maxTagCount="responsive"
        value={value}
        treeData={treeData}
        treeNodeFilterProp="searchText"
        placeholder="全部疾病"
        style={{ width: '100%' }}
        dropdownStyle={{ maxHeight: 420, overflow: 'auto' }}
        onChange={(nextValue) => {
          const selected = (nextValue as string[]).filter((item) => allDiseases.includes(item))
          onChange(selected)
        }}
      />
      <Space size={8}>
        <Button size="small" onClick={() => onChange(allDiseases)}>
          全选
        </Button>
        <Button size="small" onClick={() => onChange([])}>
          清空
        </Button>
      </Space>
    </Space>
  )
}

export function StageFilter({ stages, value, onChange }: StageFilterProps) {
  const options = useMemo(
    () =>
      stages.map((stage) => ({
        label: `${stage.matrix} (${stage.score.toFixed(1)})`,
        value: stage.value
      })),
    [stages]
  )

  const allValues = useMemo(() => stages.map((stage) => stage.value), [stages])

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Select
        mode="multiple"
        allowClear
        maxTagCount="responsive"
        placeholder="全部阶段"
        style={{ width: '100%' }}
        options={options}
        value={value}
        optionFilterProp="label"
        onChange={onChange}
      />
      <Space size={8}>
        <Button size="small" onClick={() => onChange(allValues)}>
          全选
        </Button>
        <Button size="small" onClick={() => onChange([])}>
          清空
        </Button>
      </Space>
    </Space>
  )
}

export function DiseaseSingleSelect({
  options,
  value,
  onChange,
}: DiseaseSingleSelectProps) {
  const selectOptions = useMemo(
    () =>
      options.map((item) => ({
        label: `${item.name} · ${item.ta}`,
        value: item.name
      })),
    [options]
  )

  return (
    <Select
      showSearch
      value={value}
      placeholder="请选择疾病"
      style={{ width: '100%' }}
      options={selectOptions}
      optionFilterProp="label"
      onChange={onChange}
    />
  )
}

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
          value: target
        }))
      })),
    [groups]
  )

  const allTargets = useMemo(() => groups.flatMap((group) => group.targets), [groups])

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Select
        mode="multiple"
        allowClear
        maxTagCount="responsive"
        showSearch
        disabled={disabled}
        value={value}
        placeholder="请选择靶点"
        style={{ width: '100%' }}
        options={options}
        optionFilterProp="label"
        onChange={onChange}
      />
      <Space size={8}>
        <Button size="small" disabled={disabled} onClick={() => onChange(allTargets)}>
          全选
        </Button>
        <Button size="small" disabled={disabled} onClick={() => onChange([])}>
          清空
        </Button>
      </Space>
    </Space>
  )
}

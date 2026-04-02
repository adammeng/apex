# 前端 Table 性能优化方案

> 适用场景：Ant Design Table + React 18，数据量 ≥ 1000 行时。

---

## 一、分页（首选）

最简单、收益最高的方案。将大数据集切分为小页，每次只渲染当前页的行。

```tsx
<Table
  dataSource={data}
  pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] }}
/>
```

**适用**：数据可按页消费，无需"一览全局"。

---

## 二、虚拟滚动（Virtual Scroll）

不分页但数据量大时，只渲染可视区域内的行，滚动时动态替换 DOM。

### 方案 A：Ant Design 5 内置 `virtual` 属性

```tsx
<Table
  virtual
  scroll={{ y: 600 }}
  dataSource={data}
  columns={columns}
/>
```

> 需 antd ≥ 5.9.0。

### 方案 B：`rc-virtual-list`（antd 内部依赖，可直接用）

```tsx
import VirtualList from 'rc-virtual-list'

<VirtualList
  data={data}
  height={600}
  itemHeight={48}
  itemKey="id"
>
  {(item) => <Row record={item} />}
</VirtualList>
```

### 方案 C：`@tanstack/react-virtual`（通用，灵活）

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

const rowVirtualizer = useVirtualizer({
  count: data.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48,
  overscan: 5,
})
```

**适用**：需要无限滚动 / 不分页的大列表场景。

---

## 三、减少不必要的重渲染

### 3.1 固定列数据（列定义）

列定义放在组件外或用 `useMemo`，避免每次渲染生成新数组引用。

```tsx
// ✅ 放在组件外
const COLUMNS = [{ key: 'name', title: '名称', dataIndex: 'name' }]

// 或用 useMemo
const columns = useMemo(() => [...], [deps])
```

### 3.2 行组件使用 `React.memo`

自定义单元格渲染器用 `memo` 包裹，避免无关行重渲染。

```tsx
const DrugNameCell = React.memo(({ name }: { name: string }) => (
  <span>{name}</span>
))
```

### 3.3 `rowKey` 使用稳定 ID

```tsx
// ✅
<Table rowKey="drug_id" />

// ❌ 避免用 index，index 变化会触发全量 diff
<Table rowKey={(_, index) => index} />
```

---

## 四、数据处理移出渲染阶段

### 4.1 过滤 / 排序 / 聚合用 `useMemo`

```tsx
const filtered = useMemo(
  () => rawData.filter((d) => d.status === activeStatus),
  [rawData, activeStatus]
)
```

### 4.2 大数据集计算用 Web Worker

将耗时的 transform / aggregate 逻辑移入 Worker，避免阻塞主线程。

```ts
// worker.ts
self.onmessage = (e) => {
  const result = heavyTransform(e.data)
  self.postMessage(result)
}
```

---

## 五、按需加载列（列懒渲染）

列数过多（≥ 20 列）时，隐藏不在视口内的列，或提供列显示/隐藏控制器。

```tsx
const [visibleCols, setVisibleCols] = useState<string[]>(defaultVisible)

const columns = allColumns.filter((c) => visibleCols.includes(c.key as string))
```

---

## 六、接口层优化（配合后端）

| 策略 | 说明 |
|------|------|
| 服务端分页 | 前端只请求当前页数据，`total` 由后端返回 |
| 服务端筛选/排序 | 筛选条件传给后端，减少前端数据量 |
| 字段裁剪 | 列表接口只返回列表展示所需字段，详情接口再返回全量 |
| Redis 缓存 | 高频查询结果缓存，降低 DuckDB 查询压力 |

---

## 七、方案选型建议

| 数据量 | 推荐方案 |
|--------|----------|
| < 500 行 | 直接渲染，`useMemo` 处理数据即可 |
| 500 ~ 5000 行 | 服务端分页（首选）或前端分页 |
| > 5000 行且需一次加载 | 虚拟滚动（antd `virtual` 或 `@tanstack/react-virtual`） |
| 列数 > 20 | 列显隐控制 + 固定关键列（`fixed: 'left'`） |

---

## 八、当前项目已有实践

- 所有列表接口均走 Redis 缓存（`make_cache_key` + TTL）
- DuckDB 查询通过 `get_cursor()` 隔离，支持高并发
- 前端 Axios 实例统一处理 401，避免重复鉴权请求影响体验

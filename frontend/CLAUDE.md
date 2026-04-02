# 前端开发规范 — Apex

本文件是 `frontend/` 目录下的工作约束，AI 和开发者在此目录操作前必须阅读。

## 技术栈

React 18 · TypeScript · Vite · Ant Design · React Router v6 · TanStack React Query · Zustand · Axios

---

## 目录结构

```
src/
├── pages/          # 路由页面入口，负责组装布局、触发查询、处理页面级状态
├── components/     # 跨页面复用组件，不耦合具体页面的接口格式
├── services/       # API 请求封装 + 请求/响应类型，不含 UI 逻辑
├── stores/         # Zustand：仅存跨页面的客户端状态
└── assets/         # 静态资源
```

**页面复杂度上升时**，按以下子目录演进（不要在项目早期过度拆分）：

```
src/pages/<page>/
├── index.tsx
├── components/
├── hooks/
└── types.ts
```

---

## 状态分类（最重要的规则）

| 状态类型 | 工具 | 示例 |
|---|---|---|
| 服务端数据 | React Query | 列表、详情、统计、枚举 |
| URL 可分享筛选 | URL query params | 当前选中的适应症、阶段 |
| 页面内临时 UI 状态 | `useState` / 页面 hook | 弹窗开关、当前 tab |
| 跨页面客户端状态 | Zustand | 登录态、全局筛选偏好 |

**规则：**
- React Query 管所有后端数据，包括缓存、重试、失效刷新
- Zustand 不缓存接口返回值，不与 React Query 维护同一份数据
- 单页内使用的状态不上 Zustand，用 `useState` 或页面 hook
- 影响列表结果的筛选条件优先放 URL，方便分享和回放

---

## 数据流

```
URL 参数 / Zustand 筛选
        ↓
   React Query 查询
        ↓
   页面组件拆分数据
        ↓
   展示组件渲染
        ↑
   用户交互更新筛选条件
```

子组件不私自发起与页面主查询强耦合的请求，独立详情块或懒加载区块除外。

---

## 接口层

**所有请求**通过 `src/services/request.ts`，不新建 Axios 实例。

**service 文件结构：**

```ts
// 1. 请求参数类型
export interface TrialListParams {
  ta?: string
  phase?: string
  page: number
  pageSize: number
}

// 2. 响应数据类型（贴近后端真实字段，snake_case 保持原样）
export interface Trial {
  nct_id: string
  drug_name_cn: string
  overall_status_cn: string | null
}

// 3. 纯函数请求方法，直接返回 data.data
export async function fetchTrialList(params: TrialListParams) {
  const res = await request.get<{ code: number; data: { list: Trial[]; total: number } }>(
    '/analysis/trial/list',
    { params }
  )
  return res.data.data
}
```

**React Query key 结构化，不用字符串拼接：**

```ts
['trial', 'list', params]
['pipeline', 'detail', drugId]
['dashboard', 'summary']
```

---

## 新增页面的执行顺序

1. 确认路由入口
2. 在 `services/` 定义类型和请求函数
3. 确定筛选条件放 URL / `useState` / Zustand
4. 写页面骨架，先接数据
5. 补 loading、error、empty 三态
6. 再做视觉细节

**不要先写满 JSX 再回头补数据层。**

---

## 组件与 Hook

**组件命名要业务化，体现职责：**
- 好：`FilterPanel`、`SummaryCards`、`TrialTable`、`PipelineDrawer`
- 差：`DataList`、`InfoCard`、`ItemView`

**props 接口必须显式定义，不用 `any`，可空值必须显式处理：**

```ts
// 空值处理示例
{trial.overall_status_cn ?? '-'}
{trial.start_date ? dayjs(trial.start_date).format('YYYY-MM-DD') : '-'}
```

**自定义 Hook 适用场景：**
- 筛选参数拼装
- 表格列配置
- 图表数据转换

Hook 只返回数据和处理函数，不输出 JSX。

---

## Ant Design 使用

- 列表页结构：筛选区 → 概览卡片 → 表格
- 详情优先用 `Drawer`，避免频繁堆 `Modal`
- 不用内联 `style` 堆页面，间距用统一尺度
- 表格空值统一显示 `-`，不留空白单元格

---

## TypeScript

- 所有接口数据有类型，公共组件 props 有接口定义
- 不用 `any`，不用模糊的 `string` 代替可枚举值
- 后端 snake_case 字段在前端保持原样，需要转换时做显式映射，不改原始类型

---

## 代码风格

- 不写分号
- 对象/数组末尾不写多余逗号
- 避免在 render 中做高开销的 `map/filter/reduce`，抽到 hook 或 `useMemo`
- 只在确认存在重渲染问题时引入 `useMemo/useCallback`，不提前优化

---

## 鉴权

- 登录态从 `useAuthStore` 读取
- 不在页面里重复写鉴权初始化逻辑
- 401 统一由请求层拦截处理
- 需要用户信息时从 store 读，不各页面重复调 `/me`

---

## 禁止事项

- 引入新的 UI 框架或全局状态库
- 在业务代码里新建 Axios 实例
- 页面里长期硬编码 mock 数据
- 跳过类型定义
- 后端数据结构未经整理直接散落在多个组件中使用

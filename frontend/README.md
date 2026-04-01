# Apex Frontend

`frontend/` 是 Apex 的前端应用，基于 React + TypeScript + Vite，负责承载药物研发数据的可视化展示与交互分析。

## 技术栈

- React 18
- TypeScript
- Vite
- Ant Design
- React Router
- TanStack React Query
- Zustand
- Axios

## 当前实现进度

| 模块 | 文件 | 状态 |
| --- | --- | --- |
| 基础布局（左侧导航 + 顶部栏） | `src/components/AppLayout.tsx` | 已完成 |
| 路由鉴权守卫 | `src/components/RequireAuth.tsx` | 已完成 |
| Axios 请求实例（JWT 注入 + 401 跳转） | `src/services/request.ts` | 已完成 |
| 鉴权 API 封装 | `src/services/auth.ts` | 已完成 |
| 元数据 API 封装 | `src/services/meta.ts` | 已完成 |
| 业务分析 API 封装 | `src/services/analysis.ts` | 已完成（占位） |
| Zustand 鉴权状态 | `src/stores/auth.ts` | 已完成 |
| Zustand 筛选状态 | `src/stores/filter.ts` | 已完成 |
| 数据总览页 | `src/pages/dashboard/index.tsx` | 静态占位，待联调 |
| 竞争矩阵页 | `src/pages/matrix/index.tsx` | 静态占位，待实现 |
| 研发泳道页 | `src/pages/pipeline/index.tsx` | 静态占位，待实现 |
| 竞争格局页 | `src/pages/competition/index.tsx` | 静态占位，待实现 |

## 后续重点

- 补齐各模块真实数据渲染（从 `/api/meta`、`/api/matrix`、`/api/pipeline` 拉取）
- 接入飞书登录态
- 完善筛选、详情、导出等交互
- 优化图表与大表格性能

## 环境变量

复制环境变量模板：

```bash
cp .env.example .env.local
```

可用变量：

| 变量 | 说明 |
| --- | --- |
| `VITE_FEISHU_APP_ID` | 飞书应用 ID，用于前端集成 |
| `VITE_API_BASE_URL` | 后端 API 地址，默认开发环境指向 `http://localhost:8000` |

## 启动方式

安装依赖：

```bash
npm install
```

开发环境：

```bash
npm run dev
```

生产构建：

```bash
npm run build
```

本地预览构建产物：

```bash
npm run preview
```

代码检查：

```bash
npm run lint
```

## 目录结构

```text
frontend/
├── public/              # 静态资源
├── src/
│   ├── components/      # 布局与通用组件
│   ├── pages/           # 页面级组件
│   ├── services/        # API 请求封装
│   ├── stores/          # Zustand 状态管理
│   ├── assets/          # 前端资源
│   ├── App.tsx          # 路由与全局 Provider
│   └── main.tsx         # 应用入口
├── .env.example
├── package.json
└── vite.config.ts
```

## 联调约定

- 默认通过 `VITE_API_BASE_URL` 指向后端服务
- 统一响应结构按后端 `code / msg / data` 处理
- 请求超时时间当前为 15 秒
- 遇到 `401` 时会清除本地 token 并跳转 `/login`

## 后续重点

- 补齐各模块真实数据渲染（从 `/api/meta`、`/api/matrix`、`/api/pipeline` 拉取）
- 接入飞书登录态
- 完善筛选、详情、导出等交互
- 优化图表与大表格性能

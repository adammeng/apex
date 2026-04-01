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

## 当前实现

- 基础布局已完成：左侧导航 + 顶部栏 + 内容区
- 已接入中文 `antd` locale
- 已配置统一请求实例和 JWT 注入逻辑
- 已建立四个一级页面路由：
  - `/` 数据总览
  - `/matrix` 竞争矩阵
  - `/pipeline` 研发泳道
  - `/competition` 竞争格局

当前页面以框架搭建和静态展示为主，后续会继续联调后端接口与补齐交互逻辑。

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

- 补齐各模块真实数据渲染
- 接入飞书登录态
- 完善筛选、详情、导出等交互
- 优化图表与大表格性能

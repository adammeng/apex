# Apex V1 PRD 验收报告

## 1. 验收结论

截至 2026-04-07，Apex 已基本覆盖 PRD V1 的核心范围，整体结论为：

- 核心分析能力：基本满足验收条件
- 飞书登录集成：已完成主链路实现，需结合真实飞书应用配置做最终在线验收
- 数据导出：接口已实现，需补充文件字段级核验
- 非本期范围：未纳入验收

综合判定：

- 建议结论：有条件通过

“有条件通过” 的前提是：

- 飞书生产配置正确
- 线上环境完成一次最终联调
- 导出文件字段完成业务抽样核验
- 预发/生产环境补充一次同口径性能复测

## 2. PRD 范围映射结果

| PRD 项 | 状态 | 说明 |
| --- | --- | --- |
| 飞书 SSO 登录集成 | 有条件通过 | 前后端链路已补齐，需以真实飞书配置完成最终验收 |
| 树状筛选侧边栏 | 通过 | 前端与元数据接口已具备相应实现 |
| 靶点组合竞争矩阵视图 | 通过 | 路由、查询、tooltip、导出均已实现 |
| 靶点研发进展泳道图视图 | 通过 | 路由、查询、导出均已实现 |
| 结构化数据导出至 Excel | 有条件通过 | 导出接口已实现，待补字段级业务核验 |
| 性能要求（查询/并发） | 有条件通过 | 已完成本地基线压测且满足 PRD 指标，待预发/生产环境复测 |

## 3. 验收依据与证据

### 3.1 PRD 范围证据

PRD In Scope 包含：

- 飞书 SSO 登录集成
- 树状筛选侧边栏
- 靶点组合竞争矩阵视图
- 靶点研发进展泳道图视图
- 结构化数据导出至 Excel

### 3.2 代码实现证据

- 前端路由与守卫：
  - [frontend/src/App.tsx](/Users/adam/repo/Apex/frontend/src/App.tsx)
  - [frontend/src/components/FeishuGuard.tsx](/Users/adam/repo/Apex/frontend/src/components/FeishuGuard.tsx)
  - [frontend/src/components/RequireAuth.tsx](/Users/adam/repo/Apex/frontend/src/components/RequireAuth.tsx)
- 后端接口：
  - [backend/app/routers/auth.py](/Users/adam/repo/Apex/backend/app/routers/auth.py)
  - [backend/app/routers/meta.py](/Users/adam/repo/Apex/backend/app/routers/meta.py)
  - [backend/app/routers/matrix.py](/Users/adam/repo/Apex/backend/app/routers/matrix.py)
  - [backend/app/routers/pipeline.py](/Users/adam/repo/Apex/backend/app/routers/pipeline.py)

### 3.3 已执行测试证据

- 前端 `npm run build` 通过
- 后端核心模块 `py_compile` 通过
- 后端应用对象路由枚举通过
- 飞书 H5 SDK 与授权码获取链路已完成联调定位

## 4. 验收项详细结果

### 4.1 飞书登录

结果：有条件通过

说明：

- 已实现飞书客户端识别、外部浏览器引导页、静默登录、错误诊断
- 已补齐 `app_access_token -> user_info` 服务端链路
- 是否最终通过仍取决于飞书开放平台中的真实应用配置与密钥配置

### 4.2 竞争矩阵

结果：通过

说明：

- 查询、tooltip、导出接口均存在
- 前端已接入矩阵路由与页面
- 功能结构与 PRD 的矩阵视图目标一致

### 4.3 泳道图

结果：通过

说明：

- 查询、导出接口均存在
- 前端已接入泳道页与筛选逻辑
- 功能结构与 PRD 的研发进展视图目标一致

### 4.4 导出

结果：有条件通过

说明：

- 矩阵与泳道图导出接口均已实现
- 本轮未做字段级抽样核对与业务文件复核

### 4.5 系统与部署

结果：通过

说明：

- 已支持 HTTPS 域名访问
- Docker Compose 可启动核心服务
- 飞书客户端内已可打开业务域名

### 4.6 性能要求

结果：有条件通过

说明：

- PRD 明确要求复杂筛选查询 `< 5s`、支持 `>=100` 并发用户
- 当前实现已具备 Redis 缓存、DuckDB 独立 cursor 等性能设计基础
- 本轮已在本地环境完成基线压测：
  - 矩阵冷启动 `0.025s`
  - 泳道冷启动 `0.014s`
  - 矩阵 `100` 并发 P95 `360ms`
  - 泳道 `100` 并发 P95 `657ms`
- 上述结果均优于 PRD 的 `< 5s` 查询目标，且 100 并发下无失败请求
- 由于结果仍基于本地单机环境，正式验收前建议在预发/生产环境按同口径补测一次

## 5. 未通过或待补项

- 导出任务管理接口仍为占位实现，不纳入 V1 正式功能验收
- 数据总览页、竞争格局页未实现，不纳入本期 PRD In Scope 验收
- 前后端自动化测试不足，建议后续补齐
- 性能结果已完成本地基线验证，但仍建议补一轮预发/生产环境复测

## 6. 后续建议

- 补充前端 E2E 用例，覆盖飞书容器入口、矩阵页、泳道页、导出
- 补充后端 `pytest` 接口测试，覆盖元数据、矩阵、泳道和鉴权链路
- 将导出文件字段核验纳入正式验收闭环
- 使用 `wrk` / `hey` 对矩阵与泳道接口执行 50 并发与 100 并发压测，补齐 PRD 7.1 的量化证据
- 将本次本地压测脚本沉淀为可复用命令，纳入发布前检查项

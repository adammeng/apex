# Apex API 接口文档

本文档基于当前后端实现整理，覆盖实际可用接口、请求参数、统一响应格式、鉴权方式与联调示例。

## 1. 基本信息

- 服务基址：`http://localhost:8000`
- API 前缀：`/api`
- Swagger：`http://localhost:8000/api/docs`
- ReDoc：`http://localhost:8000/api/redoc`
- OpenAPI JSON：`http://localhost:8000/api/openapi.json`

生产环境请将 `http://localhost:8000` 替换为实际部署域名，例如：

- `https://8-217-230-153.sslip.io`

## 2. 统一响应格式

除导出类接口外，所有业务接口统一返回：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {}
}
```

说明：

- `code=0` 表示成功
- `msg` 为结果说明
- `data` 为业务数据
- 发生 HTTP 异常时，FastAPI 会直接返回对应状态码和错误详情

## 3. 鉴权说明

### 3.1 JWT 头格式

需要登录态的接口通过 `Authorization` 头传递 JWT：

```http
Authorization: Bearer <access_token>
```

### 3.2 当前代码中的实际鉴权范围

当前后端代码里，只有以下接口强制校验 JWT：

- `GET /api/auth/me`

以下接口当前未在后端强制校验 JWT，但前端页面会先走飞书登录再访问：

- `/api/meta/*`
- `/api/system/*`
- `/api/matrix/*`
- `/api/pipeline/*`
- `/api/export/*`

如果后续要收口为后端强制鉴权，需要在对应路由加 `Depends(get_current_user)`。

### 3.3 飞书登录链路

**场景一：飞书客户端内（H5 静默登录）**

1. 前端在飞书容器内调用 `window.tt.requestAccess`
2. 获取临时 `code`
3. 调用 `POST /api/auth/feishu/code2token`
4. 后端完成：`app_access_token/internal` → `authen/v1/oidc/access_token` → `authen/v1/user_info`
5. 后端签发 Apex JWT 返回给前端

**场景二：外部浏览器 OAuth 网页授权**

1. 用户点击引导页「在当前浏览器中授权」
2. 跳转 `GET /api/auth/feishu/redirect`，后端组装飞书 OAuth URL 并 302 跳转
3. 飞书完成授权后回调 `GET /api/auth/feishu/callback?code=xxx`
4. 后端换取用户信息，签发 JWT，302 到前端 `/?access_token=<jwt>`
5. 前端 `FeishuGuard` 消费 URL 中的 token，存入 localStorage，清理 URL

注意：

- H5 静默登录入口是 `/api/auth/feishu/launch`
- 浏览器 OAuth 回调必须是 `/api/auth/feishu/callback`
- 若运行时环境变量把 `FEISHU_REDIRECT_URI` 错配为 `/launch`，浏览器授权完成后不会在后端执行 `code -> JWT` 交换，只会被 302 到前端页面，最终表现为“授权后仍未登录”

详细流程见：[飞书登录流程](./飞书登录流程.md)

## 4. 接口总览

| 模块 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 鉴权 | POST | `/api/auth/feishu/code2token` | 飞书 JSSDK code 换 JWT（H5 静默登录） |
| 鉴权 | GET | `/api/auth/feishu/launch` | 飞书工作台入口跳转 |
| 鉴权 | GET | `/api/auth/feishu/redirect` | 外部浏览器发起 OAuth，302 到飞书授权页 |
| 鉴权 | GET | `/api/auth/feishu/callback` | 飞书 OAuth 回调，换 JWT 后 302 到前端 |
| 鉴权 | GET | `/api/auth/me` | 获取当前登录用户 |
| 鉴权 | POST | `/api/auth/mock-login` | 开发环境 mock 登录 |
| 系统 | GET | `/api/system/health` | 健康检查 |
| 系统 | GET | `/api/system/sync-status` | 同步状态 |
| 系统 | POST | `/api/system/sync` | 手动触发同步 |
| 元数据 | GET | `/api/meta/disease-tree` | 疾病树 |
| 元数据 | GET | `/api/meta/targets` | 靶点列表 |
| 元数据 | GET | `/api/meta/stages` | 阶段枚举 |
| 元数据 | GET | `/api/meta/dictionaries` | 分析模块筛选字典 |
| 竞争矩阵 | POST | `/api/matrix/query` | 矩阵查询 |
| 竞争矩阵 | POST | `/api/matrix/tooltip` | 矩阵 Tooltip 明细 |
| 竞争矩阵 | GET | `/api/matrix/export` | 矩阵 Excel 导出 |
| 研发泳道 | POST | `/api/pipeline/query` | 泳道图查询 |
| 研发泳道 | GET | `/api/pipeline/export` | 泳道图 Excel 导出 |
| 导出任务 | GET | `/api/export/jobs` | 导出任务列表，占位 |
| 导出任务 | GET | `/api/export/jobs/{job_id}/download` | 导出文件下载，占位 |

## 5. 详细接口

### 5.1 鉴权接口

#### 5.1.1 飞书 code 换 JWT

- 方法：`POST`
- 路径：`/api/auth/feishu/code2token`
- 鉴权：否

请求体：

```json
{
  "code": "xxxxx"
}
```

成功响应：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "access_token": "jwt-token",
    "token_type": "bearer"
  }
}
```

失败示例：

```json
{
  "detail": "飞书授权失败: 获取飞书用户信息失败: code=99991663; msg=user not found; request_id=xxx; http_status=200"
}
```

#### 5.1.2 飞书网页应用入口跳转

- 方法：`GET`
- 路径：`/api/auth/feishu/launch`
- 鉴权：否

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `code` | string | 否 | 飞书 OAuth 回调 code，当前只透传 |
| `state` | string | 否 | 飞书 OAuth 回调 state，当前只透传 |

说明：

- 当前接口固定 302 到前端 `FRONTEND_URL/matrix`
- 如果传入 `code/state`，会继续拼到目标地址上

#### 5.1.3 获取当前登录用户

- 方法：`GET`
- 路径：`/api/auth/me`
- 鉴权：JWT

成功响应：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "open_id": "ou_xxx",
    "name": "张三",
    "avatar_url": "https://...",
    "email": "zhangsan@example.com"
  }
}
```

未登录时返回：

- HTTP 401
- `detail=未提供认证 Token` 或 `detail=Token 无效或已过期`

#### 5.1.4 外部浏览器发起飞书 OAuth 授权

- 方法：`GET`
- 路径：`/api/auth/feishu/redirect`
- 鉴权：否

说明：

- 组装飞书 OAuth 授权 URL（`authen/v1/authorize`），302 跳转到飞书授权页
- 需在后端配置 `FEISHU_REDIRECT_URI=https://your-domain.com/api/auth/feishu/callback`
- 用户在飞书完成授权（扫码或账密）后，飞书回调 `/api/auth/feishu/callback`

#### 5.1.5 飞书 OAuth 回调

- 方法：`GET`
- 路径：`/api/auth/feishu/callback`
- 鉴权：否

查询参数（由飞书自动携带）：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `code` | string | 飞书授权码 |
| `state` | string | 防 CSRF 随机串 |
| `error` | string | 授权失败时携带错误原因 |

授权成功：302 到 `FRONTEND_URL/?access_token=<jwt>`，前端 `FeishuGuard` 消费 token 后清理 URL。

授权失败：302 到 `FRONTEND_URL/?auth_error=<reason>`，前端展示授权失败提示页。

#### 5.1.6 开发环境 mock 登录

- 方法：`POST`
- 路径：`/api/auth/mock-login`
- 鉴权：否

说明：

- 用于本地浏览器调试
- 当前代码未显式限制 `DEBUG=true` 才可调用，生产环境应通过网关或后续代码补强限制

成功响应：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "access_token": "jwt-token",
    "token_type": "bearer"
  }
}
```

### 5.2 系统接口

#### 5.2.1 健康检查

- 方法：`GET`
- 路径：`/api/system/health`

响应示例：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "status": "ok",
    "app_name": "Apex",
    "version": "0.1.0",
    "environment": "development",
    "timestamp": "2026-04-08T15:30:00+08:00"
  }
}
```

#### 5.2.2 数据同步状态

- 方法：`GET`
- 路径：`/api/system/sync-status`

响应字段：

| 字段 | 说明 |
| --- | --- |
| `current_parquet_dir` | 当前服务使用的 parquet 目录 |
| `latest_version` | 最近一次成功同步版本 |
| `latest_sync_job` | 最近一次同步任务记录 |
| `next_sync` | 下次计划同步时间 |

说明：

- 优先从 MySQL `sync_jobs` 读取
- MySQL 不可用时，会降级读取本地文件系统推断版本

#### 5.2.3 手动触发同步

- 方法：`POST`
- 路径：`/api/system/sync`

查询参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `force` | boolean | `false` | 是否强制重新下载当天版本 |

成功响应：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "msg": "同步任务已提交，请稍后通过 /sync-status 查询结果"
  }
}
```

### 5.3 元数据接口

#### 5.3.1 疾病树

- 方法：`GET`
- 路径：`/api/meta/disease-tree`

响应示例：

```json
{
  "code": 0,
  "msg": "ok",
  "data": [
    {
      "ta": "肿瘤",
      "children": [
        {
          "name": "non-small cell lung cancer (NSCLC)",
          "drug_count": 120
        }
      ]
    }
  ]
}
```

#### 5.3.2 靶点列表

- 方法：`GET`
- 路径：`/api/meta/targets`

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `disease` | string | 否 | 按适应症过滤 |

响应字段：

| 字段 | 说明 |
| --- | --- |
| `targets` | 扁平靶点列表 |
| `groups` | 分组后的靶点列表，按首字母分组 |
| `total` | 靶点总数 |

#### 5.3.3 阶段枚举

- 方法：`GET`
- 路径：`/api/meta/stages`

响应示例：

```json
{
  "code": 0,
  "msg": "ok",
  "data": [
    {
      "value": "临床前",
      "score": 0.1,
      "matrix": "PreClinical",
      "pipeline": "PreC"
    }
  ]
}
```

#### 5.3.4 分析模块筛选字典

- 方法：`GET`
- 路径：`/api/meta/dictionaries`

响应字段：

| 字段 | 说明 |
| --- | --- |
| `disease_tree` | 疾病树，结构同 `/meta/disease-tree` |
| `diseases` | 适应症扁平列表 |
| `stages` | 阶段枚举 |

### 5.4 竞争矩阵接口

#### 5.4.1 矩阵查询

- 方法：`POST`
- 路径：`/api/matrix/query`

请求体：

```json
{
  "diseases": ["non-small cell lung cancer (NSCLC)"],
  "ta": "肿瘤",
  "stages": ["II期临床", "III期临床"],
  "min_stage_score": 2.0,
  "targets": ["EGFR", "PD-1"],
  "hide_no_combo": false
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `diseases` | string[] | 否 | 适应症列表 |
| `ta` | string | 否 | 治疗领域 |
| `stages` | string[] | 否 | 阶段过滤 |
| `min_stage_score` | number | 否 | 阶段分值下限 |
| `targets` | string[] | 否 | 限定展示的靶点 |
| `hide_no_combo` | boolean | 否 | 是否隐藏无联用的靶点 |

阶段过滤规则：

- `stages` 有值时，以 `stages` 为准
- `stages` 为空且 `min_stage_score` 有值时，后端会自动展开为不低于该分值的阶段集合

响应字段：

| 字段 | 说明 |
| --- | --- |
| `targets` | 最终展示的靶点列表 |
| `single_max` | 单靶点最高阶段 |
| `cells` | 双靶点矩阵单元格列表 |
| `legend` | 阶段图例 |
| `data_version` | 数据版本 |
| `available_target_total` | 可用靶点总数 |
| `display_target_total` | 当前展示靶点数 |

`cells` 元素示例：

```json
{
  "row_target": "EGFR",
  "col_target": "PD-1",
  "score": 3.0,
  "stage_value": "III期临床",
  "drug_count": 4
}
```

#### 5.4.2 Tooltip 明细

- 方法：`POST`
- 路径：`/api/matrix/tooltip`

请求体：

```json
{
  "row_target": "EGFR",
  "col_target": "PD-1",
  "diseases": ["non-small cell lung cancer (NSCLC)"],
  "ta": "肿瘤",
  "stages": ["II期临床", "III期临床"],
  "min_stage_score": 2.0
}
```

响应字段：

| 字段 | 说明 |
| --- | --- |
| `row_target` | 行靶点 |
| `col_target` | 列靶点 |
| `is_single` | 是否单靶点详情 |
| `drugs` | 匹配到的药物列表 |
| `data_version` | 数据版本 |

`drugs` 元素示例：

```json
{
  "drug_id": "123",
  "drug_name_en": "Drug A",
  "drug_name_cn": "药物A",
  "originator": "Company A",
  "research_institute": "Institute A",
  "highest_trial_date": "2025-01-01",
  "nct_id": "NCT00000001",
  "disease": "non-small cell lung cancer (NSCLC)",
  "ta": "肿瘤",
  "stage_value": "III期临床",
  "score": 3.0,
  "targets": ["EGFR", "PD-1"],
  "is_combo": true
}
```

#### 5.4.3 矩阵导出

- 方法：`GET`
- 路径：`/api/matrix/export`

查询参数与 `/api/matrix/query` 对齐，列表参数通过重复 key 传递，例如：

```text
/api/matrix/export?diseases=Asthma&diseases=COPD&targets=IL4R&targets=TSLP
```

返回：

- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="matrix_*.xlsx"`

### 5.5 研发泳道接口

#### 5.5.1 泳道图查询

- 方法：`POST`
- 路径：`/api/pipeline/query`

请求体：

```json
{
  "disease": "Asthma",
  "targets": ["IL4R", "TSLP"],
  "include_combo": true
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `disease` | string | 是 | 单个适应症 |
| `targets` | string[] | 否 | 限定展示的靶点 |
| `include_combo` | boolean | 否 | 是否包含联用药物 |

响应字段：

| 字段 | 说明 |
| --- | --- |
| `disease` | 当前适应症 |
| `lanes` | 阶段泳道列表 |
| `rows` | 靶点行列表 |
| `data_version` | 数据版本 |

`rows` 元素示例：

```json
{
  "target": "IL4R",
  "max_score": 4.0,
  "total_drug_count": 3,
  "cells": {
    "PreC": [],
    "IND": [],
    "Phase 1": [],
    "Phase 2": [],
    "Phase 3": [],
    "BLA": [],
    "Market": []
  }
}
```

#### 5.5.2 泳道图导出

- 方法：`GET`
- 路径：`/api/pipeline/export`

查询参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `disease` | string | 是 | 适应症 |
| `targets` | string[] | 否 | 目标靶点列表，重复 key 传值 |
| `include_combo` | boolean | 否 | 是否包含联用 |

返回：

- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="swimlane_*.xlsx"`

### 5.6 导出任务接口

#### 5.6.1 导出任务列表

- 方法：`GET`
- 路径：`/api/export/jobs`

当前状态：

- 占位接口
- 当前返回空数组和 TODO 文案

响应示例：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "jobs": [],
    "msg": "TODO: 导出任务列表待实现"
  }
}
```

#### 5.6.2 导出文件下载

- 方法：`GET`
- 路径：`/api/export/jobs/{job_id}/download`

路径参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `job_id` | integer | 导出任务 ID |

当前状态：

- 占位接口
- 当前不会真正返回文件

## 6. 联调建议

### 6.1 飞书内访问

推荐从飞书工作台入口访问：

- `https://your-domain.com/api/auth/feishu/launch`

后端会 302 到：

- `https://your-domain.com/matrix`

### 6.2 普通浏览器访问

普通浏览器访问业务页时，前端展示「请在飞书中打开」引导页，提供两个入口：

- **「在飞书客户端中打开」**：通过 applink 拉起飞书客户端
- **「在当前浏览器中授权」**：跳转 `/api/auth/feishu/redirect` 走网页 OAuth，授权完成后自动回到业务页

### 6.3 本地开发

本地联调建议：

1. 浏览器直接访问前端 dev server
2. 前端走 `mock-login`
3. 后端本地启动 Swagger 联调

## 7. 当前已知差异

- `POST /api/auth/mock-login` 当前代码可直接调用，尚未在后端按环境变量做硬限制
- 业务查询接口当前未在后端强制 JWT 校验，主要依赖前端登录流程控制访问
- `/api/export/jobs*` 仍为占位接口，不可作为正式导出任务能力使用

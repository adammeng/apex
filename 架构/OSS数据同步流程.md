# OSS 数据同步流程

## 概述

Apex 的业务数据来源于 Pharmcube 定期导出至阿里云 OSS 的 parquet 文件。后端通过定时任务（或手动触发）将最新文件拉取到本地，热更新 DuckDB 视图，清除 Redis 缓存，并将同步结果写入 MySQL。前端顶栏实时展示最后一次成功同步的时间。

---

## 触发时机

同步任务有两种触发方式：

### 1. 定时触发（主要方式）

由 APScheduler 托管，与 FastAPI 应用生命周期绑定：

- **调度时间**：每日 `05:10`（Asia/Shanghai）
- **配置项**：`settings.sync_hour`（默认 `5`）、`settings.sync_minute`（默认 `10`）
- **容错**：允许 10 分钟内的补偿触发（`misfire_grace_time=600`），服务短暂停机后恢复仍可补跑
- **行为**：始终以 `force=True` 执行，即使今日版本已存在也强制重新下载

相关代码：`backend/app/tasks/scheduler.py`

### 2. 手动触发

通过 HTTP 接口由运维或管理员手动发起：

```
POST /api/system/sync?force=false
```

- `force=false`（默认）：仅在本地 parquet 文件不完整时才下载，适合补全缺失数据
- `force=true`：无条件从 OSS 重新拉取，适合强制刷新数据
- 接口立即返回，实际同步在后台异步执行
- 执行结果通过 `GET /api/system/sync-status` 查询

相关代码：`backend/app/routers/system.py`

---

## 完整执行流程

```
触发（定时 / 手动）
        │
        ▼
[oss_sync.run_sync(force)]
        │
        ├─ 本地文件已就绪 && force=False → 返回 "skipped"
        │
        ├─ 写 MySQL sync_jobs：status=running
        │
        ├─ 在线程池中执行 _download_from_oss()
        │   ├─ 初始化 oss2.Bucket（读取 OSS 凭据）
        │   ├─ 逐一下载三个 parquet 文件到 .parquet_tmp/
        │   └─ 计算每个文件的 MD5
        │
        ├─ _archive_and_replace_parquet()
        │   ├─ 首次同步当天版本：复制到 backend/parquet/YYYYMMDD/ 归档目录
        │   ├─ 同天重复同步：若 YYYYMMDD/ 已存在则跳过归档，避免重复覆盖归档快照
        │   └─ 始终先写 .tmp 文件，再 os.replace() 原子覆盖到 backend/parquet/ 根目录
        │
        ├─ reload_conn()  ← 热更新 DuckDB
        │   ├─ 用 threading.Lock 保证线程安全
        │   ├─ 重建 in-memory 连接，注册新的 parquet 路径
        │   └─ 关闭旧连接，新 cursor 从此使用新数据
        │
        ├─ cache_flush_pattern("apex:*")  ← 清除 Redis 缓存
        │
        ├─ 写 / 更新 MySQL data_versions
        │   └─ version 已存在时仅更新 md5_map，归档目录路径保持不变
        │
        ├─ 清理超过保留天数的旧归档目录（默认保留最近 5 天）
        │
        ├─ 清理临时目录 .parquet_tmp/
        │
        └─ 写 MySQL sync_jobs：status=success / failed + md5_map / error_msg
```

---

## 涉及的三个 parquet 文件

| 设置项 | 文件名 |
|---|---|
| `parquet_ci_tracking` | `pharmcube2harbour_ci_tracking_info_0.parquet` |
| `parquet_clinical_detail` | `pharmcube2harbour_clinical_trial_detail_info_0.parquet` |
| `parquet_drug_pipeline` | `pharmcube2harbour_drug_pipeline_info_0.parquet` |

本地存储路径：`backend/parquet/`（由 `settings.parquet_path` 提供，固定不可配置）

---

## MySQL 同步记录

### `sync_jobs`

同步任务的每次执行结果写入 `sync_jobs` 表，字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `version` | varchar | 同步版本，格式 `YYYYMMDD`（Asia/Shanghai 当日） |
| `status` | varchar | `running` / `success` / `failed` |
| `md5_map` | json | 各 parquet 文件的 MD5 摘要，仅 success 时写入 |
| `error_msg` | text | 失败原因，仅 failed 时写入 |
| `created_at` | datetime | 任务开始时间（UTC） |
| `updated_at` | datetime | 最后更新时间（UTC） |

- `sync_jobs` 记录“每次执行”的结果，同一天允许多条记录
- `run_sync(force=False)` 在本地 parquet 已完整时会直接返回 `skipped`，这种跳过不会写入 `sync_jobs`

### `data_versions`

成功同步后会把版本快照写入 `data_versions` 表，用于标记当前已归档的 parquet 版本：

| 字段 | 类型 | 说明 |
|---|---|---|
| `version` | varchar | 版本号，格式 `YYYYMMDD`，唯一键 |
| `parquet_dir` | varchar | 归档目录绝对路径，如 `backend/parquet/20260407` |
| `md5_map` | json | 当次下载的 parquet MD5 摘要 |
| `created_at` | datetime | 版本首次创建时间（UTC） |

- 新版本首次同步：`INSERT`
- 同天重复同步：`ON DUPLICATE KEY UPDATE md5_map = VALUES(md5_map)`，归档目录不重复创建

---

## 前端显示：同步时间

### 数据来源

前端调用 `GET /api/system/sync-status`，后端响应结构：

```json
{
  "code": 0,
  "data": {
    "current_parquet_dir": "/path/to/backend/parquet",
    "latest_version": {
      "version": "20260403",
      "parquet_dir": "...",
      "synced_at": "2026-04-03T05:11:47+00:00"
    },
    "latest_sync_job": {
      "version": "20260403",
      "status": "success",
      "error_msg": null,
      "started_at": "2026-04-03T05:11:30+00:00",
      "updated_at": "2026-04-03T05:11:47+00:00"
    },
    "next_sync": "2026-04-04T05:10:00+08:00"
  }
}
```

字段说明：

- `latest_version.synced_at`：最近一次 **成功** 同步的完成时间（UTC ISO 8601）
- `latest_sync_job`：最近一次任务记录，无论成功与否
- `next_sync`：下次定时触发的时间，scheduler 在线时为 ISO 8601，离线时为文字说明

### 前端取值优先级

```
latest_version.synced_at        ← 最近成功时间，优先
        ↓ 为 null 时降级
latest_sync_job.updated_at      ← 最近任务更新时间
        ↓ 均为 null 时
不显示同步时间区域
```

对应代码（`frontend/src/components/AppLayout.tsx`）：

```tsx
const syncedAt = formatDateTime(
  syncStatus?.latest_version?.synced_at ?? syncStatus?.latest_sync_job?.updated_at ?? null
)
```

### 前端展示

时间通过 `formatDateTime`（`frontend/src/utils/datetime.ts`）转换为本地时区字符串，显示于顶部导航栏：

```
● 系统同步至 2026-04-03 13:11
```

- 后端返回 UTC 时间，`formatDateTime` 自动转本地时区
- `synced_at` 为 null 时此区域不渲染

---

## 降级策略

| 场景 | 行为 |
|---|---|
| OSS 凭据未配置 | `run_sync` 抛出 `RuntimeError`，写 failed，不影响在线服务 |
| OSS 下载失败 | 临时目录被清理，原 parquet 文件不受影响，DuckDB 继续用旧数据 |
| MySQL 不可用（写入时） | 仅打 warning，不影响主同步流程 |
| Redis 清除失败 | 仅打 warning，缓存自然过期（TTL 默认 3600s） |
| MySQL 不可用（前端查询时） | `/sync-status` 降级从文件系统读取版本，`synced_at` 为 null，前端不显示同步时间 |

---

## 环境变量配置

`.env` 中与同步相关的配置项：

```dotenv
# 阿里云 OSS
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET_NAME=apex-oss
OSS_PREFIX=          # parquet 文件在 bucket 中的前缀目录（可为空）

# 定时同步时间（Asia/Shanghai）
SYNC_HOUR=5
SYNC_MINUTE=10

# parquet 归档目录最多保留天数
PARQUET_ARCHIVE_KEEP_DAYS=5
```

---

## 本地开发说明

本地开发时 parquet 文件通常已手动放置在 `backend/parquet/`，`run_sync` 检测到文件存在且 `force=False` 时自动跳过下载，无需配置 OSS 凭据即可正常启动和开发。

如需在本地测试完整同步流程，手动调用：

```bash
# 触发同步（强制重新下载）
curl -X POST "http://localhost:8000/api/system/sync?force=true"

# 查询同步结果
curl "http://localhost:8000/api/system/sync-status"
```

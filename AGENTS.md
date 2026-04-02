# Apex — 药物研发智能分析平台

## 项目概述

Apex 是一个药物研发数据管理与可视化平台，数据来源为 Pharmcube 导出的 parquet 文件，面向 Harbour（港药）内部分析需求。平台提供临床试验跟踪、药物管线分析、竞争格局洞察等功能。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Ant Design + React Query + Zustand
- **后端**: Python FastAPI + DuckDB + Redis + MySQL + SQLAlchemy
- **数据层**: Parquet 文件 → DuckDB in-memory 视图
- **Python 版本**: 3.9（`backend/.venv/` 已就绪）
- **本地中间件**: MySQL 9.6（Homebrew）、Redis 8.6（Homebrew）

## 项目结构

```
Apex/
├── AGENTS.md              # 项目规范与需求（本文件）
├── README.md              # 项目入口说明
├── parquet/               # 数据源（parquet 文件）
│   ├── pharmcube2harbour_ci_tracking_info_0.parquet       # 临床试验跟踪信息（43943 行 × 63 列）
│   ├── pharmcube2harbour_clinical_trial_detail_info_0.parquet  # 临床试验详情（16282 行 × 55 列）
│   └── pharmcube2harbour_drug_pipeline_info_0.parquet     # 药物管线信息（3457 行 × 53 列）
├── backend/               # FastAPI 后端
│   ├── app/               # 应用代码
│   ├── alembic/           # 数据库迁移
│   ├── .env               # 本地环境变量（不提交）
│   └── requirements.txt
├── frontend/              # React 前端
│   ├── src/
│   └── package.json
├── deploy/                # Docker Compose + Nginx 部署配置
├── 需求/                   # 需求文档
│   └── SCR-20260330-mxen.png
├── data/                  # 运行时数据目录
└── .venv/                 # 根级 Python 虚拟环境（parquet 查看工具用）
```

## 数据源

### 1. drug_pipeline_info（药物管线信息）— 可用

- **文件**: `pharmcube2harbour_drug_pipeline_info_0.parquet`
- **规模**: 3457 行 × 53 列
- **关键字段**:
  - 药物标识: `drug_id`, `drug_name_cn`, `all_name_for_search`
  - 药物分类: `drug_type_1/2/3`, `drug_tag`, `targets`, `moa`
  - 公司信息: `company_names`, `company_names_revised`, `company_type_1/2`
  - 适应症: `diseases`, `disease_area`
  - 研发阶段: `latest_phase`（全球/中/美/欧/日/其他）
  - 日期信息: `latest_phase_start_date`, `first_appr_date`, `first_trial_date` 等
  - 交易信息: `deal_num`, `total_deal_value`, `total_upfront_payment`
  - 状态: `status`, `latest_update_time`, `latest_update_type`

### 2. ci_tracking_info（临床试验跟踪信息）— 可用

- **文件**: `pharmcube2harbour_ci_tracking_info_0.parquet`
- **规模**: 43943 行 × 63 列
- **关键字段**:
  - 治疗领域: `ta`, `harbour_indication_name`
  - 药物信息: `drug_id`, `drug_name_cn`, `drug_name_en`, `targets`, `moa`
  - 研发阶段: `global_highest_phase`, `indication_top_cn_latest_stage`, `indication_top_global_latest_stage`
  - 临床试验: `nct_id`, `highest_trial_id`, `highest_trial_phase`, `highest_trial_status`
  - 试验设计: `phase_revised`, `overall_status_cn`, `design_allocation_revised`, `intervention_model_revised`, `design_masking_revised`
  - 入组信息: `actual_enrollment_global`, `anticipated_enrollment_global`, `actual_enrollment_cn`, `anticipated_enrollment_cn`
  - 终点指标: `pri_outcome_measures`, `sec_outcome_measures`
  - 入排标准: `inclusion_criteria`, `exclusion_criteria`
  - 结果/证据: `outcome`, `relative_risk`, `key_evidence`, `summary`
  - 公司: `originator`, `research_institute`

### 3. clinical_trial_detail_info（临床试验详情）— 可用

- **文件**: `pharmcube2harbour_clinical_trial_detail_info_0.parquet`
- **规模**: 16282 行 × 55 列
- **关键字段**:
  - 试验标识: `nct_id`, `group_id`, `associate_nct_ids`
  - 试验信息: `title`, `phase`, `study_type`, `overall_status`, `why_stopped`
  - 药物/靶点: `primary_drug_names`, `other_drug_names`, `target_names`, `moa_names`
  - 干预方案: `experimental_intervention`, `control_intervention`
  - 申办方: `sponsor_official`, `sponsor_pharmcube`, `co_official`, `co_pharmcube`, `cro_official`
  - 适应症: `disease_area`, `disease_names`, `indication_desc`, `indication_mesh`
  - 时间节点: `first_posted_date`, `start_datetime`, `primary_completion_date`, `completion_date`, `ethics_date`
  - 入组: `actual_enrollment_global`, `anticipated_enrollment_global`, `actual_enrollment_cn`, `anticipated_enrollment_cn`
  - 试验设计: `design_allocation_revised`, `intervention_model_revised`, `design_primary_purpose`, `design_masking_revised`
  - 终点指标: `pri_outcome_measures`, `sec_outcome_measures`, `other_outcome_measures`
  - 研究中心: `country_names`, `number_of_facilities`, `leading_sites`, `sub_sites`

## 核心功能模块

### 模块一：数据总览（Dashboard）

- 关键指标卡片（药物总数、临床试验数、活跃管线数等）
- 按研发阶段分布图
- 按治疗领域分布图
- 按分子类型分布图
- 近期更新动态

### 模块二：临床试验分析

- 试验列表展示（表格 + 筛选）
- 按状态、阶段、适应症、公司等多维筛选
- 试验详情查看
- 试验进度追踪时间线

### 模块三：药物管线分析

- 管线可视化（按阶段 / 治疗领域 / 公司）
- 多条件组合筛选
- 管线详情页
- 管线进展趋势

### 模块四：竞争格局分析

- 公司间对比分析
- 治疗领域竞争地图
- 市场定位分析
- 靶点竞争热度

## 代码规范

### 通用

- 使用中文作为 UI 语言
- 注释可中英混合，变量名/函数名使用英文
- Git commit message 用中文，遵循下方 Commitlint 规范

### Commitlint | 提交规范

commit message 格式：`<type>: <描述>`，描述使用中文。type 取值如下：

- `build`: 构建流程、外部依赖的变更（如打包工具、依赖包版本修改）
- `chore`: 日常琐事、不影响代码逻辑的变更（如配置文件修改、删除冗余文件、格式化脚本）
- `ci`: 持续集成（CI）配置的变更（如 GitHub Actions、Jenkins 脚本修改）
- `docs`: 文档的变更（如 README 更新、注释修改、API 文档完善）
- `feat`: 新增功能（新特性、新功能模块）
- `fix`: 修复 bug（代码错误、逻辑问题等）
- `perf`: 性能优化（不改变功能逻辑，仅提升代码运行效率）
- `refactor`: 重构（既不是新增功能，也不是修复 bug，仅优化代码结构）
- `revert`: 回滚（撤销上一次提交的代码变更）
- `style`: 代码格式化（不影响代码逻辑的修改，如格式化、缩进、空格、命名规范修正）
- `test`: 测试用例的变更（如新增测试用例、修改测试用例、测试环境配置修改）

### JavaScript / TypeScript

- 不写分号
- 对象/数组末尾不写多余逗号
- 尽量给完整可运行示例

### Python

- 遵循 PEP 8
- 使用 type hints
- 使用 f-string 格式化字符串

## 开发计划

1. [x] 项目初始化 & 需求分析
2. [x] 后端搭建（FastAPI + DuckDB 数据读取层 + Redis + MySQL）
   - [x] 应用入口、配置体系、日志
   - [x] DuckDB 单例连接 + 6 张 parquet 视图
   - [x] Redis 异步缓存工具
   - [x] MySQL 建库建表（Alembic 迁移 001_sync_tables）
   - [x] 健康检查、元数据接口（疾病树 / 靶点 / 阶段枚举）
   - [x] APScheduler 定时同步骨架
   - [ ] 飞书 OAuth 完整登录流程
   - [ ] 竞争矩阵查询（/matrix/query, /matrix/tooltip）
   - [ ] 研发泳道查询（/pipeline/query）
   - [ ] 导出功能（/export/jobs, /export/jobs/{id}/download）
3. [x] 前端搭建（React + 路由 + 基础布局）
   - [x] 四页路由：/ 总览 / /matrix 竞争矩阵 / /pipeline 泳道 / /competition 竞争格局
   - [x] AppLayout（左侧导航 + 顶部栏）
   - [x] 统一请求实例（Axios + JWT 注入 + 401 跳转）
   - [x] Zustand 鉴权 & 筛选状态
   - [ ] 数据总览模块（真实数据渲染）
   - [ ] 竞争矩阵模块
   - [ ] 研发泳道模块
   - [ ] 竞争格局模块
4. [ ] 数据总览模块（前后端联调）
5. [ ] 药物管线分析模块
6. [ ] 临床试验分析模块
7. [ ] 竞争格局分析模块
8. [ ] 联调 & 测试

## 已知问题

- `app/models/sync.py` 中 `Mapped[str | None]` 需用 `Optional[str]` 替代（Python 3.9 兼容，已修复）
- `urllib3 NotOpenSSLWarning`：macOS 自带 LibreSSL 触发，不影响功能，可忽略

## 并发安全规范

- **DuckDB 查询**：业务路由中统一使用 `get_cursor()`（`core/duckdb_conn.py`），禁止直接调用 `get_conn()`。`get_cursor()` 每次返回独立 cursor，与全局连接共享内存数据库但执行上下文隔离，线程安全。`get_conn()` 仅供启动预热使用。
- **Redis 缓存键**：所有通过 `make_cache_key()` 生成的 key 格式为 `apex:<prefix>:<md5>`，与 `cache_flush_pattern("apex:*")` 命名空间一致，数据同步后缓存可被正确清除。

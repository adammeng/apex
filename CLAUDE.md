# Apex — 药物研发智能分析平台

## 项目概述

Apex 是一个药物研发数据管理与可视化平台，数据来源为 Pharmcube 导出的 parquet 文件，面向 Harbour（港药）内部分析需求。平台提供临床试验跟踪、药物管线分析、竞争格局洞察等功能。

## 技术栈

- **前端**: React（待搭建）
- **后端**: Python FastAPI（待搭建）
- **数据层**: Parquet 文件 → Pandas/PyArrow 读取
- **Python 版本**: 3.9（`.venv/` 已创建）
- **已安装依赖**: pandas, pyarrow, ipykernel

## 项目结构

```
Apex/
├── CLAUDE.md              # 本文件 — 项目规范与需求
├── parquet/               # 数据源（parquet 文件）
│   ├── pharmcube2harbour_ci_tracking_info_0.parquet       # 临床试验跟踪信息（43943 行 × 63 列）
│   ├── pharmcube2harbour_clinical_trial_detail_info_0.parquet  # 临床试验详情（16282 行 × 55 列）
│   └── pharmcube2harbour_drug_pipeline_info_0.parquet     # 药物管线信息（3457 行 × 53 列）
├── 需求/                   # 需求文档
│   └── SCR-20260330-mxen.png
├── requirements.parquet-viewer.txt
├── .venv/                 # Python 虚拟环境
└── .vscode/               # VSCode 配置
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
2. [ ] 后端搭建（FastAPI + 数据读取层）
3. [ ] 前端搭建（React + 路由 + 基础布局）
4. [ ] 数据总览模块
5. [ ] 药物管线分析模块
6. [ ] 临床试验分析模块
7. [ ] 竞争格局分析模块
8. [ ] 联调 & 测试

## 已知问题

- 暂无

# Tasks
- [x] Task 1: 明确 Top200 列表接入动量交易信号的最小数据契约
  - [x] SubTask 1.1: 梳理 Top200 列表当前 `top100_latest.rows` 的字段结构、前端依赖和 Supabase 读取链路
  - [x] SubTask 1.2: 明确 `Baseline策略` 在列表页真正需要的最小字段，如 `strategyKey`、`signalLabel`、`signalDate`、`freshnessBucket`
  - [x] SubTask 1.3: 约定未来新增信号类型与新增策略时的扩展方式，保证不因枚举写死而频繁改表结构
  - [x] SubTask 1.4: 明确策略元数据注册方式，统一承载策略名称、默认选项、展示文案和前端选择器配置

- [x] Task 2: 设计 GitHub 日计算与 Supabase 快照写入方案
  - [x] SubTask 2.1: 确认在现有 Top200 日快照脚本或相邻发布链路中复用动量信号计算能力的接入点
  - [x] SubTask 2.2: 设计“计算成功才发布、失败沿用旧快照”的发布规则，避免部分成功快照对外可见
  - [x] SubTask 2.3: 明确 Supabase 字段扩展与迁移方案，确保快照体积控制在列表页所需范围内
  - [x] SubTask 2.4: 补充 GitHub workflow 的执行与校验要求，确保线上环境由 GitHub 计算、前端只读 Supabase 快照
  - [x] SubTask 2.5: 设计同一 ETF 在单条快照记录中承载多策略最小结果的结构，避免按策略复制整份公共列表数据

- [x] Task 3: 扩展服务端 Top200 快照读取与接口契约
  - [x] SubTask 3.1: 扩展 `top100_latest` 读取与类型定义，让新信号字段可被稳定透传
  - [x] SubTask 3.2: 保持现有 Top200 列表接口和详情接口兼容旧字段，不破坏当前 `Z值` 与异动数据读取
  - [x] SubTask 3.3: 约定缺失信号字段、未知信号类型和旧快照回退时的容错展示口径
  - [x] SubTask 3.4: 保证后续新增策略时接口无需新增一套平行字段名或平行返回结构

- [x] Task 4: 在 Top200 页顶部新增轻量化策略与筛选控件
  - [x] SubTask 4.1: 新增 `交易策略` 选择器，并默认选中 `Baseline策略`
  - [x] SubTask 4.2: 新增 `交易信号`、`交易信号新鲜度` 和既有 `Z值` 的筛选入口
  - [x] SubTask 4.3: 调整顶部控制区布局，让标题、日期、刷新、搜索、策略与筛选在首屏内清晰可扫读
  - [x] SubTask 4.4: 保证新增控件后重置逻辑、数据状态提示和刷新入口仍然清楚易用

- [x] Task 5: 在 Top200 表格新增交易信号展示列
  - [x] SubTask 5.1: 新增 `交易信号` 列，并展示当前策略下的信号标签
  - [x] SubTask 5.2: 新增 `交易信号新鲜度` 列，并按 `当天 / 3日内 / 5日内 / 其它` 展示
  - [x] SubTask 5.3: 调整表格列宽、标题和密度，保证新增两列后仍然易于横向扫读
  - [x] SubTask 5.4: 保证未知或未来新增信号类型可以降级展示而不导致表格异常

- [x] Task 6: 实现组合筛选与交互回归
  - [x] SubTask 6.1: 让 `交易策略`、`交易信号`、`交易信号新鲜度` 与 `Z值` 支持组合筛选
  - [x] SubTask 6.2: 验证筛选、搜索、排序、重置和刷新之间不会互相覆盖或产生难以理解的状态
  - [x] SubTask 6.3: 保证新增筛选不会误导数据日期口径，始终明确“最近一个完整交易日快照”
  - [x] SubTask 6.4: 验证未来新增第二个策略时，顶部选择器、筛选框架和表格列无需重做即可复用

- [x] Task 7: 完成迁移、校验与交付验证
  - [x] SubTask 7.1: 补充或更新 Supabase migration、类型定义与直接相关文档说明
  - [x] SubTask 7.2: 运行直接相关验证，如类型检查、前端构建、服务端相关检查和必要的脚本冒烟
  - [x] SubTask 7.3: 验证 GitHub 计算结果写入 Supabase 后，前端能正确显示新列与新筛选
  - [x] SubTask 7.4: 验证失败发布、旧快照回退和字段缺失场景不会导致线上页面空白或错误信号
  - [x] SubTask 7.5: 验证设计文档已明确多策略扩展边界，不会把 `Baseline策略` 固化成唯一支持对象

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 3
- Task 6 depends on Task 4 and Task 5
- Task 7 depends on Task 2, Task 3, Task 5 and Task 6

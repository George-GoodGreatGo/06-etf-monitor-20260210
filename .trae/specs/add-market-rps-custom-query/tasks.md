# Tasks
- [x] Task 1: 明确“RPS自定义查询”的前后端数据契约与复用边界
  - [x] SubTask 1.1: 梳理现有“市场风格 RPS”指标、图表、成交额追踪的数据结构与可复用逻辑
  - [x] SubTask 1.2: 定义单 ETF 自定义查询接口返回结构，覆盖最新指标、前复权价格序列、Score序列、RPS起点归一序列、最近90日成交额序列
  - [x] SubTask 1.3: 明确 ETF 代码标准化、非法代码、无数据和加载失败的前后端约定

- [x] Task 2: 扩展服务端 RPS 自定义查询能力
  - [x] SubTask 2.1: 在 RPS 相关服务中补充按单个 ETF 代码查询并相对 H30269 计算 RPS / MA50 / Score 的能力
  - [x] SubTask 2.2: 输出目标 ETF 前复权价格历史、RPS原始序列、Score视图序列、最近90日成交额及前20日均值倍数
  - [x] SubTask 2.3: 新增或扩展接口路由与类型定义，确保异常场景返回稳定且可区分

- [x] Task 3: 在“市场风格 RPS”页面新增“RPS自定义查询”二级模块
  - [x] SubTask 3.1: 增加模块入口、代码输入框、默认值 `159915` 与提交交互
  - [x] SubTask 3.2: 展示最新 `RPS`、`RPS(MA50)`、`RPS Score` 及基准说明
  - [x] SubTask 3.3: 处理加载中、无数据、非法代码、请求失败等状态，避免旧结果误导

- [x] Task 4: 实现三张联动图表与起点归一交互
  - [x] SubTask 4.1: 渲染前复权价格图、MA50归一视图、RPS起点归一视图，并统一 X 轴日期对齐
  - [x] SubTask 4.2: 复用或抽取图表同步逻辑，支持三张图拖拽和缩放联动
  - [x] SubTask 4.3: 让 RPS起点归一视图在可见区间变化时按最左侧可见交易日动态归一

- [x] Task 5: 新增最近90个交易日成交额追踪展示
  - [x] SubTask 5.1: 展示 `交易日`、`当日成交额`、`相对前20个交易日均值倍数` 三列
  - [x] SubTask 5.2: 保持倍数计算、空值占位与高亮规则和现有“成交金额追踪”一致
  - [x] SubTask 5.3: 校对默认查询与自定义查询切换后表格结果、布局与滚动体验稳定

- [x] Task 6: 回归验证与交付
  - [x] SubTask 6.1: 为新增服务端计算与异常分支补充针对性测试
  - [x] SubTask 6.2: 运行相关检查（如前端 lint/typecheck、服务端测试）并修复直接相关问题
  - [x] SubTask 6.3: 验证默认代码、核心指标、三图联动、起点归一和90日成交额展示符合 spec

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1 and Task 2
- Task 4 depends on Task 2 and Task 3
- Task 5 depends on Task 2 and Task 3
- Task 6 depends on Task 2, Task 3, Task 4, and Task 5

# Tasks

- [x] Task 1: 明确 Top200 列表到 RPS 自定义查询的跳转契约
  - [x] SubTask 1.1: 确认 `RPS分析` 入口放在 `Top200 ETF` 列表每行右侧操作区，并与现有 `查看` 按钮并列展示
  - [x] SubTask 1.2: 约定使用 `/market/rps/custom-query?ticker=<ETF代码>` 作为跨页跳转地址
  - [x] SubTask 1.3: 明确缺少或无效 `ticker` 参数时继续沿用当前默认查询逻辑

- [x] Task 2: 在 Top200 列表新增 `RPS分析` 按钮入口
  - [x] SubTask 2.1: 更新 `src/components/Top100Table.tsx` 的右侧操作区布局，为每行新增 `RPS分析` 按钮
  - [x] SubTask 2.2: 点击按钮后以新窗口或新标签页打开对应的 RPS 自定义查询地址
  - [x] SubTask 2.3: 保持现有 `查看` 按钮、表格列宽与移动端滚动体验不明显回退

- [x] Task 3: 支持 RPS 自定义查询页按 URL 参数自动请求
  - [x] SubTask 3.1: 在 `src/pages/MarketRpsCustomQuery.tsx` 或 `src/components/RpsStylePanel.tsx` 读取 `ticker` 查询参数
  - [x] SubTask 3.2: 首次进入页时将有效参数同步到输入框，并自动请求该 ETF 的结果
  - [x] SubTask 3.3: 避免 URL 参数初始化与默认查询、用户手动查询之间发生重复请求或状态覆盖

- [x] Task 4: 回归验证与交付
  - [x] SubTask 4.1: 验证从 Top200 列表点击 `RPS分析` 后，目标页会新开窗口并携带正确 ETF 代码
  - [x] SubTask 4.2: 验证目标页能自动展示对应 ETF 的摘要、图表与成交额结果
  - [x] SubTask 4.3: 验证不带 `ticker` 参数直接进入“自定义查询”页时，原有默认行为保持不变
  - [x] SubTask 4.4: 运行直接相关检查，如前端 `lint`、`typecheck` 或等价验证

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3

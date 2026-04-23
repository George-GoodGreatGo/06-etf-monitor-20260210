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
- Task 6 depends on Task 5
- Task 7 depends on Task 5 and Task 6

- [x] Task 5: 调整 Top200 列表中 RPS 入口列的表头与按钮文案
  - [x] SubTask 5.1: 在 `src/components/Top100Table.tsx` 中为 RPS 跳转入口补充独立表头 `RPS分析`
  - [x] SubTask 5.2: 将当前 RPS 跳转按钮文案从 `RPS分析` 调整为 `查看`
  - [x] SubTask 5.3: 保持 `异动详情` 列及其跳转行为不变，不影响现有详情入口

- [x] Task 6: 对齐 RPS 入口按钮与异动详情按钮的视觉样式
  - [x] SubTask 6.1: 复用或对齐 `异动详情` 按钮的边框、背景、字号、间距与 hover 样式
  - [x] SubTask 6.2: 校对新增样式后两列按钮在同一行中的对齐、宽度和密度表现
  - [x] SubTask 6.3: 保证 mock 页复用 `Top100Table` 时，样式调整不会破坏本地回归链路

- [x] Task 7: 回归验证本轮表头与样式调整
  - [x] SubTask 7.1: 验证表头已显示 `RPS分析`，且每行按钮文案为 `查看`
  - [x] SubTask 7.2: 验证 `RPS分析` 列按钮样式与 `异动详情` 按钮样式一致
  - [x] SubTask 7.3: 验证 `RPS分析` 跳转与 `异动详情` 跳转仍可正常使用
  - [x] SubTask 7.4: 运行直接相关检查，如前端 `lint`、`typecheck` 或等价验证

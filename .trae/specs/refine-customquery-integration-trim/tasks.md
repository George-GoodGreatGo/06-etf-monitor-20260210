# Tasks

- [x] Task 1: 移除 Hero 卡片底部「输入值」行
  - [x] SubTask 1.1: 删除 [line 1032-1034](file:///d:/A-AI学习/T-Trae国际版/06-etf-monitor-20260210/src/components/RpsStylePanel.tsx#L1032-L1034) 的 `<div className="mt-2 text-[11px] text-[#64748B]">输入值：...` 整行

- [x] Task 2: 标题横幅改为纯文字
  - [x] SubTask 2.1: 将 `customQueryIntro` 的 `<section className="overflow-hidden rounded-lg bg-[#0F172A] px-4 py-3 shadow-md">` 改为 `<div className="pb-1">`
  - [x] SubTask 2.2: 确认标题文字「动量分析」和副标题不变

- [x] Task 3: 搜索栏与最近搜索视觉整合
  - [x] SubTask 3.1: 用同一个外层容器 `overflow-hidden rounded-lg bg-[#0F172A] shadow-md` 包裹 `<form>` 搜索栏 + 最近搜索区域
  - [x] SubTask 3.2: 搜索栏保持 `<form>` 内的圆角 pill 样式不变，去外层独立阴影
  - [x] SubTask 3.3: 最近搜索区域去掉独立的 `rounded-xl border border-[rgba(71,85,105,0.22)] bg-[linear-gradient(...)]` 外框，改为纯内联内容
  - [x] SubTask 3.4: 搜索栏和最近搜索之间用 `border-t border-white/5` 分割线隔开

- [x] Task 4: 同步更新 Mock HTML
  - [x] SubTask 4.1: 移除 Hero 底部输入值行
  - [x] SubTask 4.2: 标题改为纯文字
  - [x] SubTask 4.3: 搜索栏+最近搜索整合

- [x] Task 5: 回归验证
  - [x] SubTask 5.1: `tsc --noEmit` 零错误
  - [x] SubTask 5.2: `eslint RpsStylePanel.tsx` 零错误
  - [x] SubTask 5.3: 确认 `customQuerySection` 中其余逻辑（搜索提交、策略切换、图表渲染）未受影响

# Task Dependencies
- Task 1、Task 2、Task 3 互不依赖，可并行
- Task 4 依赖 Task 1、2、3
- Task 5 依赖 Task 1、2、3、4

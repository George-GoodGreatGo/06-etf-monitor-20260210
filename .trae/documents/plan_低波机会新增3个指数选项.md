# 低波机会新增3个指数选项实施计划

## Summary
- 目标：在“低波机会”中新增 3 个可选指数：
  - 自由现金流 `932365`（TRI: `932365CNY010`）
  - 中证红利质量 `932315`（TRI: `932315CNY010`）
  - 国证价值100 `980081`（TRI: `480081`）
- 范围：保留当前已有 7 个低波指数，新增 3 个后共 10 个可选项。
- 展示顺序：按你的要求“放在最后面”，即先保持原 7 个顺序，再追加 3 个。
- 数据源映射决策：
  - `932365` / `932315`：`csindex`
  - `980081`：`cnindex`（PRI=`980081`，TRI=`480081`）

## Current State Analysis
- 前端低波选项来源：
  - `src/pages/Home.tsx` 的 `LOWVOL_INDEX_OPTIONS` 当前仅包含 7 个低波指数。
  - 低波卡片/图表读取逻辑会遍历 `LOWVOL_INDEX_OPTIONS` 并调用 `/api/lowvol/summary`、`/api/lowvol/index/:code`。
- 后端低波支持列表：
  - `server/lib/lowVol.ts` 的 `LOWVOL_INDEXES` 决定支持的 `code/priCode/triCode/dataSource`。
  - `getLowVolSupportedIndexCodes()` 直接返回 `LOWVOL_INDEXES` 键集合，影响 summary 与刷新脚本处理范围。
- 已有可参考信息：
  - `server/lib/valueTiming.ts` 中 `980081` 使用 `cnindex`，可作为低波新增时的数据源一致性参考。

## Proposed Changes

### 1) 更新后端支持代码清单（核心）
- 文件：`server/lib/lowVol.ts`
- 改动内容：
  - 在 `LOWVOL_INDEXES` 末尾新增 3 项配置：
    - `932365`: `{ priCode: '932365', triCode: '932365CNY010', dataSource: 'csindex' }`
    - `932315`: `{ priCode: '932315', triCode: '932315CNY010', dataSource: 'csindex' }`
    - `980081`: `{ priCode: '980081', triCode: '480081', dataSource: 'cnindex' }`
  - 配置 `name` 使用中文名称，便于日志与 meta notes 可读。
- 原因：
  - 低波 API 的支持范围由该表驱动；不改这里，前端新增选项会报“不支持的指数 code”。

### 2) 更新前端低波选项列表（UI）
- 文件：`src/pages/Home.tsx`
- 改动内容：
  - 在 `LOWVOL_INDEX_OPTIONS` 末尾追加 3 个选项（不调整原 7 个顺序）：
    - `932365` / “自由现金流”
    - `932315` / “中证红利质量”
    - `980081` / “国证价值100”
  - 为三个选项补充低波场景描述文案（简洁、与低波模块一致口径）。
- 原因：
  - 低波卡片、默认状态 map、建议计算 map 都基于该常量自动扩展；新增后无需额外改动状态结构。

### 3) 一致性与兼容检查
- 文件：`src/components/LowVolOpportunityPanel.tsx`（仅确认，无结构变更）
- 文件：`src/utils/marketApi.ts`（仅确认，无结构变更）
- 文件：`server/routes/lowVol.ts`（仅确认，无结构变更）
- 检查点：
  - 新 code 走现有 `/api/lowvol/index/:code` 无需新增接口。
  - 建议计算 `calcLowVolSuggestion()` 使用统一阈值，不需要额外分支。

## Assumptions & Decisions
- 已确认决策：
  - 保留原 7 个低波指数并新增 3 个。
  - 新增项放在低波卡片列表末尾。
  - 数据源映射按“`932365/932315` 走 `csindex`，`980081` 走 `cnindex`”执行。
- 假设：
  - 上游对 `932365CNY010`、`932315CNY010`、`480081` 的历史序列可访问，且满足现有低波计算的最小重叠样本要求。

## Verification Steps
1. 静态校验
- 前端构建通过（TypeScript/Vite）。
- 后端编译通过（若工程包含独立后端类型检查则一起通过）。

2. API 可用性验证
- 分别调用：
  - `GET /api/lowvol/index/932365`
  - `GET /api/lowvol/index/932315`
  - `GET /api/lowvol/index/980081`
- 期望：返回 `success=true`，`data.series` 非空，`meta.source` 与数据源映射一致（`980081` 显示 `cnindex + chinamoney`）。

3. Summary 联动验证
- 调用 `GET /api/lowvol/summary`，检查 `items` 包含新增 3 个 code，且前端低波卡片出现对应建议与股息率信息（可为空但不报错）。

4. 前端交互验证
- 页面切到“低波机会”，确认共 10 张指数卡片。
- 逐一点击新增 3 个卡片，图表能加载，顶部指数名称/code 与数据日期显示正常。
- 切换 BIAS 基准（SMA250/SMA60）后建议文本仍正常联动。

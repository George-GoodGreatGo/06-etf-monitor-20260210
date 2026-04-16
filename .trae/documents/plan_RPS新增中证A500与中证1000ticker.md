# 计划：RPS新增中证A500与中证1000Ticker

## 1. Summary
- 目标：在 RPS 模块新增两个目标 ticker：`512050`（中证A500）与 `560010`（中证1000），纳入现有 RPS 计算、快照发布、矩阵/图表展示全链路。
- 范围：仅改现有 RPS 前后端配置与映射，不改数据库表结构与接口协议。
- 结果预期：新增标的在定时刷新后写入 run，前端表格与三视图图表可见且支持既有交互逻辑。

## 2. Current State Analysis
- 后端目标池在 `server/lib/rpsStyle.ts` 中由常量 `RPS_TARGET_TICKERS` 控制，当前仅包含 4 个 ticker。
- 刷新脚本 `server/scripts/refreshRpsStyleSnapshots.ts` 通过 `getRpsStyleSupportedTickers()` 读取同一目标池，因此只要扩展该常量即可进入发布链路。
- 前端 `src/components/RpsStylePanel.tsx` 维护：
  - `DEFAULT_TICKERS`（矩阵空数据时回退展示）
  - `ETF_NAME_MAP`（中文名显示、图表基准文案）
- 前端 `src/components/charts/RpsStyleChart.tsx` 已引入固定颜色映射 `TICKER_COLOR_MAP`，新 ticker 需补充固定色以保持识别一致性。

## 3. Proposed Changes

### 3.1 扩展后端RPS目标Ticker池
- 文件：`server/lib/rpsStyle.ts`
- 改动：
  - 在 `RPS_TARGET_TICKERS` 中追加 `512050.SH` 与 `560010.SH`。
- 影响：
  - `computeRpsStyleDataset` 会对新增 ticker 抓取前复权数据并计算 RPS/MA50/Score。
  - `getRpsStyleMatrix/getRpsStyleSummary/getRpsStyleSeries` 自动纳入新增标的。
  - 定时刷新与手动刷新 run 发布行数增加。

### 3.2 更新前端默认标的与中文名映射
- 文件：`src/components/RpsStylePanel.tsx`
- 改动：
  - `DEFAULT_TICKERS` 追加 `512050.SH`、`560010.SH`。
  - `ETF_NAME_MAP` 增加：
    - `512050.SH`: 中证A500ETF（或项目约定的标准中文名）
    - `560010.SH`: 中证1000ETF（或项目约定的标准中文名）
- 影响：
  - 表格“Ticker/中文名”可正确展示新增标的。
  - 指标开关区新增对应按钮。
  - 当矩阵接口异常回退到默认列表时，新增标的仍可见。

### 3.3 更新图表固定颜色映射
- 文件：`src/components/charts/RpsStyleChart.tsx`
- 改动：
  - 在 `TICKER_COLOR_MAP` 增加 `512050.SH` 与 `560010.SH` 的固定颜色。
  - 颜色需与现有 palette 区分明显，避免与当前 5 个已映射 ticker 冲突。
- 影响：
  - 三视图下新增 ticker 颜色在刷新、切换视图、开关显隐时保持稳定不漂移。

### 3.4 保持接口与发布模型不变
- 文件：无结构变更（说明项）
- 决策：
  - 不新增 migration；`rps_style_point` 已支持任意 ticker 文本值。
  - 不改 API 入参/出参结构，前端按现有渲染逻辑自动消费新增项。

## 4. Assumptions & Decisions
- 本次“加入新的ticker”定义为“在现有目标池基础上追加”，不是替换原有 4 个 ticker。
- ticker 统一采用项目当前口径（带交易所后缀）：`512050.SH`、`560010.SH`。
- 中文名以 ETF 口径展示；若后续需要精确到基金简称，可单独再调文案。

## 5. Verification Steps
- 后端验证：
  - 运行 RPS 刷新脚本后日志中的 `tickers` 数量应从 4 变为 6。
  - 产出数据中包含 `512050.SH`、`560010.SH` 的点位。
- 接口验证：
  - `summary/matrix` 返回的 `items` 包含新增 ticker。
  - `series/:ticker` 对新增 ticker 可正常返回时间序列。
- 前端验证：
  - 表格与“图表指标（Ticker）”出现新增标的及中文名。
  - 三视图中新增 ticker 线条可正常显示，颜色稳定且与图例一致。
- 工程验证：
  - `npm run build` 通过。
  - 相关修改文件无新增诊断错误。

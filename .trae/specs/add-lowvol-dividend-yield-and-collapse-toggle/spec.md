# Add LowVol Dividend Yield and Collapse Toggle Spec

## Why
用户希望在低波机会板块中更直观地看到各指数的“股息收益率”数据，以便于评估指数的绝对分红吸引力。此外，指数切换卡片占据了较大的页面高度，提供一个折叠/展开功能可以帮助用户精简信息，提升屏幕空间的利用率。

## What Changes
- 修改 API `getLowVolSummary` 返回的数据结构，包含 `dividendYieldPct`。
- 修改 `src/utils/marketApi.ts` 中的 `LowVolLatestSummary` 类型，加入 `dividendYieldPct` 字段。
- 在 `src/components/LowVolOpportunityPanel.tsx` 右侧摘要数据区，增加“股息收益率”的数值展示。
- 在 `src/pages/Home.tsx` 中的指数切换卡片区，增加“股息收益率”的数值展示。
- 在 `src/pages/Home.tsx` 中为指数切换卡片区增加“展开/收起”状态及切换按钮（默认展开）。
- 当切换为“收起”状态时，卡片内隐藏指数的详细描述文本（`desc`），减小卡片的内边距（padding），从而大幅缩减切换区的高度。

## Impact
- Affected specs: 低波机会面板、大盘看板顶部的切换组件。
- Affected code:
  - `server/lib/lowVol.ts`
  - `src/utils/marketApi.ts`
  - `src/pages/Home.tsx`
  - `src/components/LowVolOpportunityPanel.tsx`

## ADDED Requirements
### Requirement: 股息收益率展示
The system SHALL provide `dividendYieldPct` data from the snapshot summary API, and the frontend SHALL display it formatted as a percentage in both the summary panel and the index selection cards.

#### Scenario: Success case
- **WHEN** user views the Low Volatility opportunity tab
- **THEN** they can see the "股息收益率: X.XX%" on each index card and in the detailed summary panel.

### Requirement: 卡片展开与收起
The system SHALL provide a toggle button to expand or collapse the index selection cards area.

#### Scenario: Collapse state
- **WHEN** user clicks the "收起" (Collapse) button
- **THEN** the index description text is hidden, the card padding is reduced, and the toggle button text changes to "展开" (Expand).

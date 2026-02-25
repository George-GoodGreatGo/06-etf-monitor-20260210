# ETF 详情页周线图表实现方案 Spec

## Why
ETF 详情页需要提供对标 TradingView 的周线图表能力，让用户在同一交易日口径下快速完成趋势判断与技术指标解读。

## What Changes
- ETF 详情页新增“周线图表”模块（固定周线，但支持缩放/平移查看历史）。
- 图表由 4 个 Pane 组成：
  - Pane 0：前复权收盘价折线 + EMA(8) + SMA(200)
  - Pane 1：成交量柱状图（按涨跌着色）
  - Pane 2：RSI(14)
  - Pane 3：MACD(12,26,9)，含 MACD/Signal/Histogram
- 交互对标 TradingView：平滑 zoom/pan、十字光标跨 Pane 同步、Tooltip 实时数值、图例切换显隐、时间刻度导航、移动端触控友好、暗黑金融主题。
- 数据口径：用户进入详情页时立即加载“截至同一交易日”的周频数据（包含最新交易日，可能为不完整周）。
- 采用 TradingView Lightweight Charts (v4+) 作为图表库实现多 Pane 与核心交互。

## Impact
- Affected specs: ETF 详情页、图表交互体验、数据接口与缓存策略
- Affected code (预期):
  - `src/pages/EtfDetail.tsx`（或等价详情页）
  - `src/components/charts/*`（新增/调整）
  - `src/utils/*`（时间格式、数值格式）
  - `server/routes/*`（新增周线图表 API）
  - `server/services/*`（数据拉取/聚合/指标计算）

## ADDED Requirements
### Requirement: 周线图表数据接口
系统 SHALL 提供接口用于返回指定 ETF 的周线图表数据，并保证同一交易日口径。

#### Scenario: 正常获取周线数据
- **WHEN** 客户端请求 `/api/etf/{code}/weekly-chart?adjust=qfq`
- **THEN** 服务端返回截至当前交易日的周线数据（包含可能的不完整周）
- **AND** 返回数据包含 close_qfq、ema8、sma200、volume、rsi14、macd(12/26/9) 三序列

#### Scenario: 缓存命中
- **WHEN** 同一 code 与同一 end_date 反复请求
- **THEN** 服务端优先返回缓存数据以降低第三方数据源压力

### Requirement: 周线图表渲染与交互
系统 SHALL 在 ETF 详情页渲染 4-pane 周线图表，并提供对标 TV 的核心交互。

#### Scenario: 页面加载
- **WHEN** 用户进入 ETF 详情页
- **THEN** 图表模块立即进入 loading 状态并拉取周线图表数据
- **AND** 数据到达后完成 4-pane 渲染，且十字光标在各 pane 时间轴同步

#### Scenario: 系列显隐
- **WHEN** 用户在图例切换 EMA/SMA/Volume/RSI/MACD 任意序列
- **THEN** 对应序列立即显隐，不影响其他 pane 的 crosshair 与缩放

### Requirement: 指标计算一致性
系统 SHALL 使用标准参数计算 EMA(8)、SMA(200)、RSI(14)、MACD(12,26,9)，并保证与常见行情软件的定义一致。

## MODIFIED Requirements
### Requirement: ETF 详情页信息结构
ETF 详情页 SHALL 在不降低现有信息可读性前提下新增周线图表模块，并在移动端保持可用（滑动、缩放、tooltip 可触达）。

## REMOVED Requirements
无

## Data Contract
服务端返回 JSON（示例字段，最终以实现为准）：
```json
{
  "meta": {
    "code": "510300",
    "adjust": "qfq",
    "dataDate": "2026-02-24",
    "snapshotAt": "2026-02-24T21:20:07.000Z",
    "freq": "W",
    "isPartialWeek": true
  },
  "series": {
    "price": [{"time": 1708732800000, "value": 1.234}],
    "ema8": [{"time": 1708732800000, "value": 1.210}],
    "sma200": [{"time": 1708732800000, "value": 1.050}],
    "volume": [{"time": 1708732800000, "value": 123456789, "color": "#10B981"}],
    "rsi14": [{"time": 1708732800000, "value": 55.2}],
    "macd": {
      "macd": [{"time": 1708732800000, "value": 0.012}],
      "signal": [{"time": 1708732800000, "value": 0.008}],
      "hist": [{"time": 1708732800000, "value": 0.004, "color": "#EF4444"}]
    }
  }
}
```


# Tasks
- [x] 任务 1：确认代码结构与页面入口
  - [x] 定位 ETF 详情页路由与页面组件（EtfDetail 或等价）
  - [x] 规划图表模块组件边界（ChartContainer / Pane 组件 / Tooltip / Legend）

- [x] 任务 2：实现周线图表数据接口
  - [x] 新增 API：`GET /api/etf/{code}/weekly-chart?adjust=qfq`
  - [x] 接入数据源（AkShare/Tushare 或现有数据管道），确保可获取 qfq 周线或日线聚合
  - [x] 实现“同一交易日口径”周线聚合（含 partial week）
  - [x] 计算指标：EMA8、SMA200、RSI14、MACD(12/26/9)
  - [x] 增加缓存策略（按 code+adjust+dataDate/snapshotAt 缓存）

- [x] 任务 3：前端集成 Lightweight Charts 多 Pane
  - [x] 引入 lightweight-charts 并封装为可复用 chart 组件
  - [x] 实现 4-pane：价格+均线、成交量、RSI、MACD
  - [x] 暗黑主题与样式对齐（字体、颜色、网格线、坐标轴）
  - [x] 图例显隐与 Tooltip（跨 pane 同步）

- [x] 任务 4：交互对标与移动端优化
  - [x] zoom/pan 平滑体验与重置视图
  - [x] 十字光标跨 pane 同步（时间一致）
  - [x] 移动端触控：拖拽、缩放、tooltip 可读

- [x] 任务 5：验证与回归
  - [x] 验证：最新交易日包含在数据里（partial week 时 isPartialWeek=true）
  - [x] 验证：指标数值合理且连续（与常见行情软件定义一致）
  - [x] 验证：交互（crosshair/tooltip/legend/zoom/pan）无明显卡顿
  - [x] `npm run check` / `npm run build` 通过

# Task Dependencies
- 任务 3 依赖 任务 2
- 任务 4 依赖 任务 3
- 任务 5 依赖 任务 2、任务 3、任务 4

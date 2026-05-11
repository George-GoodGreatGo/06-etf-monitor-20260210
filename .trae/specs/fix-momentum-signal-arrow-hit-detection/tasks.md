# Tasks
- [x] Task 1: 修正 `resolveSignalMarkerFromClick` 中 Y 坐标的 position 偏移补偿
  - [x] SubTask 1.1: 在 `resolveSignalMarkerFromClick` 中，根据 `candidate.position`（`atPriceTop` 向上偏移 / `atPriceBottom` 向下偏移）对 `series.priceToCoordinate()` 的结果叠加视觉偏移量
  - [x] SubTask 1.2: 偏移量通过常量 `MARKER_VISUAL_OFFSET_FACTOR` 控制，取 `candidate.size * 8`（与 lightweight-charts 渲染比例近似一致），确保偏移随 size 缩放
  - [x] SubTask 1.3: 保持命中半径 `SIGNAL_MARKER_HIT_RADIUS_PX = 18` 不变，仅修正坐标计算

- [x] Task 2: 回归验证
  - [x] SubTask 2.1: 运行前端 `lint` 和 `typecheck`（`npx tsc --noEmit`），无新增类型或语法错误
  - [ ] SubTask 2.2: 在本地 DEV 模式下打开动量分析页，验证买入箭头和卖出箭头点击均可正常命中并弹出信号详情弹窗
  - [ ] SubTask 2.3: 验证主图 hover、缩放、平移、十字光标联动不受影响

# Task Dependencies
- Task 2 depends on Task 1

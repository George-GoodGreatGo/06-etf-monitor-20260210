* [x] `resolveSignalMarkerFromClick` 已根据 `candidate.position` 对 Y 坐标进行偏移补偿（`atPriceTop` 向上偏移、`atPriceBottom` 向下偏移）

* [x] 偏移量使用 `candidate.size * MARKER_VISUAL_OFFSET_FACTOR` 计算（factor=8），与 lightweight-charts 渲染比例一致

* [x] 命中半径 `SIGNAL_MARKER_HIT_RADIUS_PX` 保持 18 不变

* [x] 前端 typecheck（`npx tsc --noEmit`）通过，无类型错误

* [x] 前端 lint 通过，无新增警告

* [ ] 买入箭头（红色向上）点击可正常命中并弹出买入信号详情

* [ ] 卖出箭头（绿色向下）点击可正常命中并弹出卖出信号详情

* [ ] 风控卖出/确认卖出箭头点击可正常命中

* [ ] 主图 hover、缩放、平移、十字光标与副图联动无回归


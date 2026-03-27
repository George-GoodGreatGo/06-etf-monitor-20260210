# Tasks

- [x] Task 1: 调研并确定 Baostock 字段口径
  - [x] 确认沪深300 PE 可用字段（如 `peTTM`）与数据频率
  - [x] 确认 10Y 国债收益率数据接口、字段与单位（% 或 小数）

- [x] Task 2: 接入 Baostock 数据拉取通道
  - [x] 新增 `server/python/baostock_service.py`：输出 PE 与 10Y收益率日序列 JSON
  - [x] 新增 `server/lib/baostock.ts`：Node 侧调用 Python 并提供缓存/超时/错误包装（参考现有 Python 调用方式）

- [x] Task 3: 后端切换股债性价比输入数据源
  - [x] 在 `/api/market/liquidity/v5` 中优先使用 Baostock 返回的 PE 与 10Y收益率
  - [x] 保持交易日对齐（以沪深300交易日为主）并做 ffill
  - [x] Baostock 失败时回退现有数据源，并在 meta 中标记来源

- [x] Task 4: 回归前端与类型
  - [x] 确认接口返回结构不破坏现有前端渲染
  - [x] 必要时更新 `src/utils/marketApi.ts` 类型（保持向后兼容）

- [x] Task 5: 验证
  - [x] `npm run build` 通过
  - [x] 手动验证：股债性价比分位历史跨度变长、空缺明显减少、日期对齐不破坏三窗格同步

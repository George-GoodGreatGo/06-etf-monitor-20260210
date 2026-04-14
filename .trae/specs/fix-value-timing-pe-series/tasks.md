# Tasks
- [ ] Task 1: 修复 CSIndex indicator xls 解析为完整历史序列
  - [ ] SubTask 1.1: 扩展日期解析：支持字符串日期与 Excel 数字日期（序列号）两种格式
  - [ ] SubTask 1.2: 动态定位表头与列：识别“日期/市盈率/股息率”列，避免硬编码列下标导致漏解析
  - [ ] SubTask 1.3: 多 sheet 兼容：若首个 sheet 不含目标表头，扫描其他 sheet 选择最匹配的
  - [ ] SubTask 1.4: 增强日志/notes：输出 `pe_points` 与缺失比例，便于发现异常

- [ ] Task 2: 修复 980081 PE 推算口径（去除 pe=0 假有效值）
  - [ ] SubTask 2.1: 明确“ETF 品种不提供 f162”的现状，并将 `pe<=0` 统一视为缺失（`pe=null`）
  - [ ] SubTask 2.2: 选择并实现可靠的替代估值来源（按优先级尝试）：
    - 优先：国证/国证官网或公开接口能提供的历史估值（PE）序列
    - 备选：Eastmoney 提供的“指数估值”数据（非 ETF 行情字段）或可重复验证的第三方估值数据源
  - [ ] SubTask 2.3: 在快照 `notes` 中记录 provider 与降级原因；在 UI 保持“推算口径”提示不变

- [ ] Task 3: 回归验证
  - [ ] SubTask 3.1: 单测覆盖 Excel 数字日期解析与表头定位（至少包含 932315/932365 的样例或 mock）
  - [ ] SubTask 3.2: 单测覆盖 980081：当获取到 `pe=0` 时应视为缺失并触发降级（不参与计算）
  - [ ] SubTask 3.3: 本地通过 `npm run check` 与 `npm run test:unit`

# Task Dependencies
- Task 3 depends on Task 1 and Task 2


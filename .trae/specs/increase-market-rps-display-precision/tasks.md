# Tasks
- [x] Task 1: 明确市场风格RPS截面表格的精度调整范围
  - [x] SubTask 1.1: 确认 `RPS` 与 `MA50` 当前格式化入口和默认小数位
  - [x] SubTask 1.2: 确认 `Score%`、趋势与排序不属于本次调整范围
  - [x] SubTask 1.3: 选择新的展示精度规则，并确保对所有行一致生效

- [x] Task 2: 提升RPS与MA50的显示小数位
  - [x] SubTask 2.1: 调整“Score 截面数据”表格中 `RPS` 与 `MA50` 的格式化位数
  - [x] SubTask 2.2: 校对空值、异常值与非数字占位在新精度下仍正常显示
  - [x] SubTask 2.3: 确认本次改动不影响底层数据、趋势方向与 `Score%` 展示

- [x] Task 3: 回归验证与交付
  - [x] SubTask 3.1: 检查更高精度下表格列宽、对齐和可读性是否稳定
  - [x] SubTask 3.2: 运行直接相关检查并确认无新增报错
  - [x] SubTask 3.3: 验证小量级 `RPS` / `MA50` 值不再因显示精度不足而看起来接近为 `0`

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2

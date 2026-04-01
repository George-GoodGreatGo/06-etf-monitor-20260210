# Tasks

- [x] 1. 梳理现有主图渲染结构：确认主图（沪深300）系列创建、数据写入与 hover 映射的扩展点。
- [x] 2. 实现 BOLL120 计算函数（TypeScript）：
  - [x] 2.1 输入为按日期正序的 close 序列，输出为与输入等长的 `mid/upper/lower/bandwidth`（前 119 天为 null）
  - [x] 2.2 严格使用样本标准差（n-1），并对无效 close、MB=0 等边界做缺失值处理
  - [x] 2.3 添加清晰中文注释
- [x] 3. 在主图创建并渲染 BOLL 三条线：
  - [x] 3.1 增加 showBoll 状态与按钮（工具栏与 EMA 同风格）
  - [x] 3.2 新增 MB/UB/LB 三个 series，支持显示/隐藏
  - [x] 3.3 将计算结果转换为图表数据点（跳过 null 段）
- [x] 4. 扩展 hover 信息：在 showBoll 开启时展示 MB/UB/LB 与带宽 Bandwidth。
- [x] 5. 校验与回归：
  - [x] 5.1 TypeScript 类型检查通过（`npm run check`）
  - [x] 5.2 主图现有功能不受影响（EMA 开关、红绿高亮段、时间轴联动）

# Task Dependencies
- 3 依赖 2
- 4 依赖 2 与 3

# Tasks

## Task 1: 移除旧 Strategy Selector 卡片
- [x] **步骤 1.1**：打开 `src/pages/MarketRpsMethodology.tsx`
- [x] **步骤 1.2**：定位并删除旧 Strategy Selector `<section>` 卡片区块
- [x] **步骤 1.3**：确保删除后结构为 `<PageBreadcrumb>` → `<nav>` Tab 栏 → 内容 `<section>`
- [x] **验证**：文件中不再出现 `"STRATEGY SELECTOR"`、`"策略选择"` 文字及 `rounded-full` 类名

## Task 2: 新增策略 Tab 页签栏
- [x] **步骤 2.1**：在 `</PageBreadcrumb>` 之后、第一个内容 `<section>` 之前，插入新的 Tab 栏 JSX
- [x] **步骤 2.2**：实现 Tab 栏容器：`<nav>` 包裹 `<Link>`，使用 `border-b border-white/10` 作为底部整体分隔线
- [x] **步骤 2.3**：每个 Tab 项使用 `<Link>`（保持现有路由机制），激活态底部 `border-b-2 border-[#7DD3FC]`
- [x] **步骤 2.4**：每个 Tab 项渲染策略 `label` + 角色徽章（通过 `strategy.roleLabel` 区分样式）
- [x] **步骤 2.5**：Tab 项使用统一的过渡类 `transition-all duration-200 ease-in-out`
- [x] **步骤 2.6**：Tab 栏下方渲染策略描述文字（`selectedStrategy.selectorDescription`）
- [x] **验证**：Tab 栏视觉输出符合 spec 定义的激活态/默认态/hover 态样式

## Task 3: 验证功能完整性
- [x] **步骤 3.1**：TypeScript 编译通过，默认策略 `confirmTrail12` 确认生效
- [x] **步骤 3.2**：Tab Link 使用 `buildMomentumMethodPath` 生成正确 URL
- [x] **步骤 3.3**：策略切换通过 URL 参数驱动，数据逻辑不变
- [x] **步骤 3.4**：`<PageBreadcrumb>` 组件未修改，面包屑正常
- [x] **步骤 3.5**：下方内容卡片代码未修改，数据流保持不变
- [x] **验证**：TypeScript exit 0，ESLint exit 0，Vite 热更新无报错

# Task Dependencies
- Task 2 依赖 Task 1（先删除旧卡片，再添加新 Tab 栏）
- Task 3 依赖 Task 2（验证是最终确认步骤）

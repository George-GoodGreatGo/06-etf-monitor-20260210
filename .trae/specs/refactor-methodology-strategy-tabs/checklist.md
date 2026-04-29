# Checklist

- [x] **旧 Strategy Selector 卡片已删除**：`MarketRpsMethodology.tsx` 中不再出现 `"STRATEGY SELECTOR"` 文字、`"策略选择"` 文字、`rounded-full` 类名及对应的 `<section>` 卡片区块
- [x] **Tab 页签栏已正确插入**：Tab 栏位于 `<PageBreadcrumb />` 之后、第一个内容 `<section>` 之前
- [x] **Tab 栏容器样式正确**：使用 `<nav>` 标签、底部 `border-b border-white/10` 整体分隔线
- [x] **Tab 项激活态样式正确**：激活的 Tab 项底部显示 `border-b-2 border-[#7DD3FC]` 青色指示条、文字为 `text-white`
- [x] **Tab 项默认态样式正确**：非激活 Tab 项文字为 `text-[#94A3B8]`、底边透明、hover 时文字变白
- [x] **角色徽章正确**：「默认策略」徽章为浅青底+青文字，「对照策略」徽章为浅灰底+灰文字
- [x] **过渡动画正确**：所有 Tab 项包含 `transition-all duration-200 ease-in-out`
- [x] **策略描述文字正确**：Tab 栏下方显示当前策略的 `selectorDescription`，样式为 `text-xs text-[#64748B]`
- [x] **间距符合规范**：面包屑到 Tab 栏、Tab 栏到内容区间距由 `PageContentContainer space-y-5` 控制
- [x] **路由切换正常**：所有 Tab 使用 `buildMomentumMethodPath(item.id)` 生成 Link 目标
- [x] **页面内容联动正常**：策略数据通过 `getMomentumStrategy(searchParams.get('strategy'))` 驱动，内容卡片代码未修改
- [x] **默认策略正确**：`DEFAULT_MOMENTUM_STRATEGY_ID = 'confirmTrail12'`，无 URL 参数时自动使用默认策略
- [x] **仅修改目标文件**：除 `src/pages/MarketRpsMethodology.tsx` 外无其他文件被修改
- [x] **无控制台错误**：TypeScript 编译通过（exit 0），ESLint 检查通过（exit 0），Vite 热更新无报错
- [x] **面包屑导航正常**：`<PageBreadcrumb>` 组件未修改，路径和文字保持不变

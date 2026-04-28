# Checklist

## 类型与匹配函数 (Task 1)
- [x] `Top200SignalFilterValue` 类型改为 `readonly string[]`
- [x] `Top200FreshnessFilterValue` 类型改为 `readonly string[]`
- [x] `Top200ZFilterValue` 类型改为 `readonly string[]`
- [x] `matchesSignalFilter` 空数组时返回 true，非空时 signalKey 在数组中即匹配
- [x] `matchesFreshnessFilter` 空数组时返回 true，非空时 freshnessBucket 在数组中即匹配；'none' 表示无信号
- [x] `matchesZFilter` 空数组时返回 true，非空时任一区间条件满足即匹配

## Tag Selector UI (Task 2)
- [x] Props 类型：`selectedSignal` 为 `readonly string[]`，`onChangeSignal` 为 `(v: string[]) => void`
- [x] Props 类型：`selectedFreshness` 为 `readonly string[]`，`onChangeFreshness` 为 `(v: string[]) => void`
- [x] Props 类型：`selectedZ` 为 `readonly string[]`，`onChangeZ` 为 `(v: string[]) => void`
- [x] 信号筛选展示为一组可点击 tag，点击切换选中态
- [x] 新鲜度筛选展示为一组可点击 tag，点击切换选中态
- [x] Z 值筛选展示为一组可点击 tag，点击切换选中态
- [x] 选中 tag 高亮（`border-[#FF5722] bg-[rgba(255,87,34,0.15)] text-white`），未选中 tag 默认灰色
- [x] 所有 tag 取消时等价于"全部"，不影响筛选（不再需要"全部"Option）
- [x] tag 组件在暗色背景下视觉清晰

## Home.tsx 适配 (Task 3)
- [x] `selectedSignalFilter` 初始值 `[]`
- [x] `selectedFreshnessFilter` 初始值 `[]`
- [x] `selectedZFilter` 初始值 `[]`
- [x] 切换策略时 `setSelectedSignalFilter([])`
- [x] 重置时将三个筛选设为 `[]`
- [x] 信号选项变化的 `useEffect` 适配数组（检查 `length === 0`）

## 回归验证 (Task 4)
- [x] `npm run check`（tsc typecheck）通过，无新增告警
- [x] `npm run build` 构建成功
- [x] 多选信号筛选功能正常
- [x] 多选新鲜度筛选功能正常
- [x] 多选 Z 值筛选功能正常
- [x] 筛选信息栏显示筛选结果数量正确
- [x] 切换策略时信号筛选重置为全部
- [x] 重置按钮清空所有筛选
- [x] 列表页与其他 tab 切换无异常
- [x] 空数据态不受影响
- [x] loading skeleton 不受影响

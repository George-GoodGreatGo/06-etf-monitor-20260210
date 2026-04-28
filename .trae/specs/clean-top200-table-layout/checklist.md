# Checklist

## 取消斑马纹
- [x] 数据行 `<tr>` 无 `even:bg-[rgba(255,255,255,0.02)]` 类
- [x] 所有数据行背景一致，无交替颜色

## 表头禁止换行
- [x] `<thead>` 含 `whitespace-nowrap`
- [x] 表头文字始终显示在一行内，不换行

## 操作按钮禁止换行
- [x] actionButtonClassName 含 `whitespace-nowrap`
- [x] "查看"文字与图标始终在一行

## 回归验证
- [x] `npm run check`（tsc typecheck）通过，无新增告警
- [x] `npm run build` 构建成功
- [x] 表格排序功能正常
- [x] 筛选功能正常
- [x] loading、空数据、错误态显示正常
- [x] 按钮跳转（RPS分析 / 异动详情）正常

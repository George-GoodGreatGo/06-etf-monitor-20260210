# 计划：修复 Home 导入误报与 Tailwind 未知规则告警

## 1. Summary
- 目标：解决两类“编辑器诊断问题”并保持构建行为不变。
  - `Home.tsx` 中 `ValueTimingPanel` 的模块解析误报。
  - `src/index.css` 中 `@tailwind` 的 Unknown at-rule 告警。
- 已确认策略：
  - 导入修复采用“改为相对路径”。
  - Tailwind 告警采用“仓库级忽略”。

## 2. Current State Analysis
- 现象验证：
  - `npm run check`（`tsc --noEmit`）通过，说明编译链路是健康的。
  - `GetDiagnostics` 仍报：
    - `src/pages/Home.tsx`: 找不到模块 `@/components/ValueTimingPanel`。
    - `src/index.css`: `Unknown at rule @tailwind`（3条）。
- 代码现状：
  - `Home.tsx` 当前使用 `import ValueTimingPanel from '@/components/ValueTimingPanel'`。
  - `src/components/ValueTimingPanel.tsx` 文件存在且默认导出正常。
  - 项目有 `tailwind.config.js` 与 `postcss.config.js`，说明运行时 Tailwind 链路正常，警告来自编辑器 CSS 语言服务。

## 3. Proposed Changes

### A. 解决 Home 导入误报（改为相对路径）
- 文件：`src/pages/Home.tsx`
- 变更：
  - 将 `ValueTimingPanel` 的导入从别名路径改为相对路径：
    - `@/components/ValueTimingPanel` -> `../components/ValueTimingPanel`
- 原因：
  - 该方案与你偏好一致，且能在不依赖编辑器别名解析状态的前提下立即消除误报。

### B. 仓库级关闭 CSS unknownAtRules 告警
- 文件：`.vscode/settings.json`（新建）
- 变更：
  - 添加（或合并）设置：
    - `"css.lint.unknownAtRules": "ignore"`
- 原因：
  - `@tailwind` 是 Tailwind 指令，不应作为普通 CSS 未知规则持续告警；仓库级设置可统一团队体验。

## 4. Assumptions & Decisions
- 决策（已确认）：
  - 导入修复优先稳定性，采用相对路径而非继续依赖 `@` 别名。
  - 告警处理采用仓库级配置，而非仅本机临时设置。
- 不变项：
  - Tailwind 构建链路（`postcss/tailwind`）不改。
  - 业务逻辑、页面功能、运行时输出不改。

## 5. Verification Steps
- 静态验证：
  - 运行 `npm run check`，确保类型检查仍通过。
  - 运行 `GetDiagnostics`，确认：
    - `Home.tsx` 不再出现 `ValueTimingPanel` 导入错误。
    - `src/index.css` 的 `Unknown at rule @tailwind` 告警消失。
- 回归验证：
  - 启动页面并访问首页，确认价值择时面板加载正常，无导入回归。

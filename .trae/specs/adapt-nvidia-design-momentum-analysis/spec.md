# 动量分析页 NVIDIA 设计语言适配 Spec

## Why
当前动量分析页（`/market/rps/custom-query`）基于深色金融主题设计（暗色背景 `#0B1220`、重阴影、大号圆角、多色强调），与项目的 `design-md-nvdia/DESIGN.md` 所定义的 NVIDIA 设计体系（纸白画布、单色强调 `#76b900`、2px 角、无阴影 hairline 边框）完全不搭。需要将动量分析页的 chrome 层（容器、卡片、按钮、边框、文字颜色）迁移到 NVIDIA 设计语言，同时完整保护所有业务逻辑和图表组件。

## Design Reference
`d:\A-AI学习\T-Trae国际版\06-etf-monitor-20260210\design-md-nvdia\DESIGN.md`

### 核心设计参数（提取自 DESIGN.md）
| Token | 值 | 用途 |
|-------|:---:|------|
| `primary` | `#76b900` | 唯一强调色：主 CTA、Score 正数值、角标 |
| `primary-dark` | `#5a8d00` | 按钮 pressed 态 |
| `ink` | `#000000` | 标题、核心数据 |
| `body` | `#1a1a1a` | 正文数字 |
| `mute` | `#757575` | 标签文字、副标题 |
| `ash` | `#a7a7a7` | 禁用态 |
| `error` | `#e52020` | 负数/下跌 |
| `success-deep` | `#3f8500` | Score 中性/贴零 |
| `hairline` | `#cccccc` | 卡片边框、表格线 |
| `hairline-strong` | `#5e5e5e` | 深色基底上的分割线 |
| `surface-soft` | `#f7f7f7` | 表头/交替行背景 |
| `surface-elevated` | `#1a1a1a` | 暗色嵌套面板 |
| `canvas` | `#ffffff` | 页面主背景 |
| `rounded.sm` | `2px` | **所有**交互元素统一圆角 |
| 字体 | Inter 400/700 | NVIDIA-EMEA 最佳开源替代 |

## What Changes

### P0 — 基础设施（CSS 变量 + 字体）
- `index.html` 或全局 CSS 引入 Inter 字体（从 Google Fonts 或本地）
- 页面容器背景从 `#0B1220` 改为 `#ffffff`
- 全局页面文字色从 `text-[#F8FAFC]` 改为 `text-[#000000]` / `text-[#1a1a1a]`
- 所有 `rounded-lg` / `rounded-md` 改为 `rounded-sm` (2px)
- **页面整体文字色从浅色变为深色，需逐区域修改所有硬编码文字色**

### P1 — Hero 卡片 + 搜索栏
- **Hero 卡片**: `bg-[#0F172A] shadow-md` → `bg-white border border-[#cccccc] rounded-sm`（扁平无影）
  - Score 标题色 `text-[#94A3B8]` → `text-[#757575]`（mute）
  - Score 数值：正数 `#76b900`（NVIDIA 绿），负数 `#e52020`（error）
  - 其他主指标值 `#1a1a1a`（body）
  - 主指标竖分隔线 `bg-white/10` → `bg-[#cccccc]`
  - 主指标 gap 分隔：`border-r border-[#cccccc]`（hairline）
  - 副指标脚注色：标签 `#757575`，数值 `#757575`
- **搜索栏**: `rounded-full` → `rounded-sm`（矩形）
  - 外框 `border-white/[0.07]` → `border-[#cccccc]`
  - 背景 `bg-white/[0.03]` → `bg-white`
  - 查询按钮渐变 → 纯色 `bg-[#76b900] text-[#000000] rounded-sm`
  - `min-h-[56px]` → `h-[44px]`（对齐 `text-input` height）
- **标题横幅**: `text-white` → `text-[#000000]`，副标题 `#757575`

### P2 — 策略选择区 + 成交额表格
- **策略选择区卡片**: `bg-[rgba(11,18,32,0.82)] shadow-sm` → `bg-white border border-[#cccccc]`
- **策略 pills**: `rounded-xl` → `rounded-sm`（2px 方角 tab）
  - 激活态: `bg-[#000000] text-white`（`pill-tab-active`）
  - 非激活: `bg-transparent text-[#1a1a1a]`
- **成交额表格**:
  - 外层 `shadow-md rounded-lg` → `rounded-sm`
  - 表头 `bg-white/5` → `bg-[#f7f7f7]`（surface-soft）
  - 表格边框 `border-[#1E293B]` → `border-[#cccccc]`
  - 行分割线 `border-t border-[#162033]` → `border-t border-[#cccccc]`
  - 放量高亮行 `bg-[rgba(203,184,255,0.10)]` → `bg-[#f7f7f7]`
  - 放量高亮文字 `text-[#CBB8FF]` → `text-[#76b900]`（NVIDIA 绿高亮）

### 不修改范围（黑盒保护）
- **RpsCustomQueryCharts** 组件内部所有代码
- 所有 API 请求、状态管理逻辑
- `DataStatusBanner` 组件本身（仅修改其容器上下文的底色，不修改组件内部）
- `turnoverSection` 变量中的 overview 总览页成交额区
- 总览页（`isOverviewPage` 分支）

### 颜色语义重定义
A 股惯例「红涨绿跌」与 NVIDIA 单色强调体系存在冲突，处理如下：
- **Score 正数**（强于 MA50）：使用 `#76b900`（NVIDIA 绿 = 「强」）
- **Score 负数**（弱于 MA50）：使用 `#e52020`（error 红 = 「弱」）
- **较昨变化 / 较前7日变化**：保持 A 股惯例，正数 `#e52020`（红涨），负数 `#3f8500`（绿跌）
- **Score Badge**（强于MA50/弱于MA50 标签）：跟随 Score 数值色

## Impact
- Affected specs: `refine-momentum-summary-hero-and-deborder`、`refine-hero-cards-v3-layout-and-color`、`refine-customquery-integration-trim`
- Affected code: `src/components/RpsStylePanel.tsx`（`customQueryIntro`、搜索栏、Hero 卡片、策略选择区、成交额追踪区）、`mock/momentum-analysis.html`
- **BREAKING**: 无。不修改任何业务逻辑、API 调用、图表渲染。

## ADDED Requirements

### Requirement: NVIDIA 设计 Token 全局基础
系统 SHALL 在页面容器层将背景色从深色改为白色，并为动量分析页建立 NVIDIA 设计体系的颜色变量和字体。

#### Scenario: 页面背景为白色
- **WHEN** 用户访问 `/market/rps/custom-query` 页面
- **THEN** 页面背景为 `#ffffff`
- **THEN** 字体为 Inter 400/700

#### Scenario: 所有容器统一 2px 圆角
- **WHEN** 页面渲染任何卡片、按钮、输入框
- **THEN** 圆角统一为 `2px`（`rounded-sm` 或 `rounded-[2px]`）
- **THEN** 不再出现 `rounded-lg`（8px）、`rounded-md`（6px）、`rounded-full`

### Requirement: 无阴影扁平卡片体系
系统 SHALL 在所有卡片组件上移除 `shadow-md` / `shadow-sm` / `shadow-lg`，改用 `1px solid #cccccc` hairline 边框。

#### Scenario: Hero 卡片无阴影
- **WHEN** Hero 摘要卡片渲染
- **THEN** 容器使用 `bg-white border border-[#cccccc]` 无阴影

#### Scenario: 策略选择区无阴影
- **WHEN** 策略选择区渲染
- **THEN** 容器使用 `bg-white border border-[#cccccc]` 无阴影

### Requirement: 单色强调体系
系统 SHALL 使用 NVIDIA 绿 `#76b900` 作为唯一正向/强调色，错误红 `#e52020` 作为负向色。

#### Scenario: Score 正数显示 NVIDIA 绿
- **WHEN** Score 值 > 0
- **THEN** Score 数值和 Badge 使用 `#76b900` 色系

#### Scenario: Score 负数显示错误红
- **WHEN** Score 值 < 0
- **THEN** Score 数值和 Badge 使用 `#e52020` 色系

### Requirement: 搜索栏矩形化
系统 SHALL 将搜索栏从圆形 pill 改为 2px 圆角矩形输入框。

#### Scenario: 搜索栏为矩形
- **WHEN** 页面渲染搜索栏
- **THEN** 搜索栏使用 `rounded-sm`（2px），高度 `h-[44px]`
- **THEN** 查询按钮为 NVIDIA 绿填充 `bg-[#76b900] text-[#000000]`

### Requirement: 成交额表格浅色化
系统 SHALL 将成交额追踪表格从深色风格改为浅色风格。

#### Scenario: 表头为浅灰
- **WHEN** 成交额表格渲染
- **THEN** 表头背景为 `#f7f7f7`
- **THEN** 行分割线为 `#cccccc`
- **THEN** 放量高亮行为 `#f7f7f7` 底色 + `#76b900` 文字

## MODIFIED Requirements

### Requirement: 红涨绿跌 → NVIDIA 单色 + error 红
修改 `resolveScoreState` 颜色映射：
- `score > 0`: `valueCls` = `text-[#76b900]`，`toneCls` 使用 `#76b900` 色系
- `score < 0`: `valueCls` = `text-[#e52020]`，`toneCls` 使用 `#e52020` 色系
- `pctToneCls`：`v > 0` → `text-[#e52020]`（红涨），`v < 0` → `text-[#3f8500]`（绿跌）——保持 A 股惯例

# 动量分析页整合精简 Spec

## Why

当前动量分析页顶部存在三个视觉冗余：① Hero 卡片底部的「输入值」行是重复信息（标的名已在卡片标题行展示）；② 搜索栏和最近搜索是两块独立容器，视觉割裂感强；③ 标题横幅仍沿用卡片样式，与已去边框化的其余区块风格不一致。需要进一步精简整合。

## What Changes

* 移除 Hero 卡片底部的「输入值：xxx」行

* 搜索栏和最近搜索合并为一个视觉容器（搜索栏在上、最近搜索紧贴其下，共用同一 `rounded-lg` 外框）

* `customQueryIntro` 标题横幅从卡片改为纯文字行（无背景、无圆角、无阴影）

## Impact

* Affected specs: `refine-momentum-summary-hero-and-deborder`、`refine-hero-cards-v3-layout-and-color`

* Affected code: `src/components/RpsStylePanel.tsx`（`customQueryIntro` JSX、搜索栏+最近搜索容器结构、Hero 卡片底部行）

* **BREAKING**: 无

## MODIFIED Requirements

### Requirement: Hero 卡片移除输入值行

系统 SHALL 在 Hero 卡片底部移除「输入值：xxx」信息行。

#### Scenario: 查询成功不显示输入值

* **WHEN** 用户成功查询 ETF 数据

* **THEN** Hero 卡片内不展示「输入值」行

* **THEN** 标的名和代码已在 Hero 标题行正常展示

### Requirement: 标题横幅改为纯文字

`customQueryIntro` SHALL 从 `<section>` 卡片改为纯文字 `<div>`，无背景色、无圆角、无阴影。

#### Scenario: 标题仅展示文字

* **WHEN** 页面渲染标题区域

* **THEN** 显示「动量分析」标题和副标题文字

* **THEN** 不使用任何背景色（`bg-[#0F172A]`）、圆角（`rounded-lg`）、阴影（`shadow-md`）、内边距（`px-4 py-3`）

### Requirement: 搜索栏与最近搜索视觉整合

搜索栏和最近搜索 SHALL 共用同一个视觉容器，搜索栏在上、最近搜索紧贴其下，用微妙分割线隔开。

#### Scenario: 搜索栏和最近搜索合并在同一区块

* **WHEN** 页面渲染搜索区域

* **THEN** 搜索栏（圆角输入框）和最近搜索（胶囊标签）在同一个 `rounded-lg` 容器内

* **THEN** 搜索栏在上方，最近搜索在下方

* **THEN** 两者之间用细分割线（`border-t border-white/5`）隔开

* **THEN** 不再有两个独立的外框（搜索栏的独立圆形外框可保留，但外层整合为一个容器）


# 自定义查询ETF中文名识别 Spec

## Why
当前“市场风格RPS > 自定义查询”在部分 ETF 查询结果中，摘要区虽然已经展示“代码 + 名称”，但名称来源仍可能退化为 `ETF 513310` 一类通用占位文本，无法帮助用户快速辨识标的。需要补强名称解析链路，优先返回真实中文名称，并在结果展示位直接呈现。

## What Changes
- 强化 RPS 自定义查询接口的 ETF 名称解析逻辑，避免未知代码直接退化为通用占位名
- 优先使用已维护的 RPS 标的配置名称；未命中时，尝试从可复用的 ETF 元数据来源解析中文名称
- 查询结果摘要区与图表辅助文案继续直接展示 `中文名称 + 代码` 或 `代码 + 中文名称`
- 仅在确实无法解析中文名称时，才允许回退到代码或通用占位文本
- 为名称解析新增针对性验证，覆盖已知代码、扩展代码与名称缺失降级场景

## Impact
- Affected specs: `市场风格RPS自定义查询`
- Affected code: `server/lib/rpsStyle.ts`, `server/routes/rpsStyle.ts`, `server/tests/rpsStyleCustomQuery.test.ts`, `src/components/RpsStylePanel.tsx`

## ADDED Requirements
### Requirement: 自定义查询优先返回可辨识ETF中文名
系统 SHALL 在 RPS 自定义查询返回结果中，优先提供能够帮助用户识别标的的 ETF 中文名称，而不是默认输出泛化占位名。

#### Scenario: 已知ETF直接返回中文名
- **WHEN** 用户查询已收录在 RPS 标的配置中的 ETF
- **THEN** 返回结果中的 `name` 为该 ETF 的中文名称
- **AND** 摘要区直接展示该中文名称及代码

#### Scenario: 非预置ETF通过元数据解析中文名
- **WHEN** 用户查询未预置在 RPS 标的配置中的 ETF，但系统可从 ETF 元数据来源解析到中文名称
- **THEN** 返回结果中的 `name` 使用解析出的中文名称
- **AND** 摘要区直接展示该中文名称及代码

#### Scenario: 名称无法解析时安全降级
- **WHEN** 用户查询的 ETF 暂时无法解析到中文名称
- **THEN** 系统允许降级展示代码或通用占位文本
- **AND** 不得覆盖已成功解析出的中文名称

## MODIFIED Requirements
### Requirement: 自定义查询结果摘要的标的展示
系统 SHALL 在自定义查询结果摘要区的“当前标的”位置直接展示便于识别的 ETF 中文名称与代码；若两者同时可用，展示结果应明确包含中文名称，不得仅显示代码或机械占位名。

#### Scenario: 查询成功后的摘要识别增强
- **WHEN** 用户输入 ETF 代码并查询成功
- **THEN** “当前标的”位置展示中文名称与代码
- **AND** 同页其他复用该名称字段的位置保持一致

## REMOVED Requirements

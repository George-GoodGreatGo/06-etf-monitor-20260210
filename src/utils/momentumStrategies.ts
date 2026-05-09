import {
  CONFIRM_TRAIL12_BACKTEST_AGGREGATE,
  CONFIRM_TRAIL12_BACKTEST_ROWS,
  CONFIRM_TRAIL12_BACKTEST_SOURCE,
  CONFIRM_TRAIL12_METHOD_SECTIONS,
  CONFIRM_TRAIL12_SUMMARY_LINES,
  type ConfirmTrail12BacktestRow,
  type ConfirmTrail12MethodSection,
} from '@/utils/confirmTrail12Methodology'

export type MomentumStrategyId = 'confirmTrail12' | 'baseColorFlip'
export type MomentumStrategySignalPreset = MomentumStrategyId
export type MomentumMethodSection = ConfirmTrail12MethodSection
export type MomentumBacktestRow = ConfirmTrail12BacktestRow
export type MomentumBacktestAggregate = typeof CONFIRM_TRAIL12_BACKTEST_AGGREGATE
export type MomentumSignalLegendTone = 'buy' | 'sell' | 'risk' | 'turnover'
export type MomentumSignalLegendItem = {
  key: string
  tone: MomentumSignalLegendTone
  text: string
}

export type MomentumStrategyDefinition = {
  id: MomentumStrategyId
  label: string
  shortLabel: string
  roleLabel: '默认策略' | '对照策略'
  selectorDescription: string
  signalPreset: MomentumStrategySignalPreset
  summaryLines: readonly string[]
  methodTitle: string
  methodLeadParagraphs: readonly string[]
  methodCtaDescription: string
  sections: readonly MomentumMethodSection[]
  backtestSource: string
  backtestAggregate?: MomentumBacktestAggregate
  backtestRows?: readonly MomentumBacktestRow[]
  signalLegend: readonly MomentumSignalLegendItem[]
}

const BASE_COLOR_FLIP_SUMMARY_LINES = [
  '基础颜色切换策略直接使用价格分段颜色变化：绿转黄记为买点，黄转绿记为卖点。',
  '该策略不额外要求 SMA250、SMA20、MACD、RSI 或 trailing stop 等确认条件，信号更敏感。',
  '它主要用于和默认的 Baseline策略 做图上对照，帮助理解“纯颜色切换”与“带确认过滤”的差别。',
] as const

const BASE_COLOR_FLIP_METHOD_SECTIONS: readonly MomentumMethodSection[] = [
  {
    title: '策略定位',
    description: '基础颜色切换策略保留最原始的价格分段切换口径，作用是提供一个低门槛、低解释成本的对照版本，用来观察颜色切换本身的节奏感。',
    bullets: [
      '买卖点完全由价格分段颜色变化驱动，不叠加趋势过滤或止损增强。',
      '它更容易出现连续来回切换，适合作为默认策略的对照参考，而不是替代默认产品口径。',
      '当用户希望快速理解“颜色切换本身意味着什么”时，可以先看这套基础规则。',
    ],
  },
  {
    title: '指标定义',
    description: '该策略仍复用当前动量分析页面上的同一批价格、Score 和副图指标，但信号判定只使用主图价格分段颜色。',
    bullets: [
      '价格分段颜色沿用现有 Score 着色：绿<0、黄=0~10、橙=10~20、红>20。',
      '主图仍可同时查看 SMA20、SMA60、SMA250、MACD、RSI 和放量标记，用于辅助解读。',
      '这些指标在本策略下只承担观察作用，不直接参与买卖点触发。',
    ],
  },
  {
    title: '买入规则',
    description: '买点定义为价格分段由弱转稳的第一天，强调切换时点本身。',
    bullets: [
      '前一交易日价格分段颜色为绿。',
      '当日价格分段颜色转为黄。',
      '满足后在主图标记买入箭头，不额外检查 SMA250 等趋势过滤条件。',
    ],
  },
  {
    title: '卖出规则',
    description: '卖点定义为价格分段由稳转弱的第一天，保持与买点完全对称的颜色切换逻辑。',
    bullets: [
      '前一交易日价格分段颜色为黄。',
      '当日价格分段颜色转为绿。',
      '满足后在主图标记卖出箭头，不额外要求短周期指标确认。',
    ],
  },
  {
    title: '边界条件',
    description: '由于该策略不叠加更多过滤，因此边界说明主要聚焦颜色切换是否真实发生。',
    bullets: [
      '若某日缺失 Score 或无法形成价格分段颜色，则该日不生成买卖点。',
      '同一轮持仓中，系统仍按“买入后等待下一次有效卖点”顺序记录信号，避免重复持仓。',
      '该策略不生成单独的增强风控卖点，因此主图不会出现额外的金色卖出箭头。',
    ],
  },
  {
    title: '实现口径',
    description: '当前版本先把该策略作为可切换的对照口径接入统一架构，便于未来继续补充研究归档与样本结果。',
    bullets: [
      '图上信号由前端根据价格分段颜色变化本地计算，和默认策略共享同一套基础行情序列。',
      '页面简介、图例和方法页均来自统一策略注册表，不再把颜色切换说明散落在多个组件中。',
      '当前未单独沉淀正式样本回测表，后续若研究完成，可直接补充到同一策略元数据结构中。',
    ],
  },
] as const

export const DEFAULT_MOMENTUM_STRATEGY_ID: MomentumStrategyId = 'confirmTrail12'
export const MOMENTUM_ANALYSIS_PATH = '/market/rps/custom-query'
export const MOMENTUM_METHOD_PATH = '/market/rps/methodology'

export const MOMENTUM_STRATEGIES: readonly MomentumStrategyDefinition[] = [
  {
    id: 'confirmTrail12',
    label: 'Baseline策略',
    shortLabel: '确认卖出+12%风控',
    roleLabel: '默认策略',
    selectorDescription: '适合直接作为主图默认口径，结合确认卖出与 12% 风控，平衡信号质量与回撤控制。',
    signalPreset: 'confirmTrail12',
    summaryLines: CONFIRM_TRAIL12_SUMMARY_LINES,
    methodTitle: 'Baseline策略 分析方法',
    methodLeadParagraphs: [
      '本页用于归档 `Baseline策略` 的正式产品口径，统一回答默认买点怎么触发、确认卖点如何判定、12% trailing stop 为什么存在，以及研究样本回测结果如何。',
      '页面结构按“总述、规则正文、研究结果”收敛，目标是让产品、研发和研究复用时都能直接把这里当作 PRD 或方法说明的基础版本。',
    ],
    methodCtaDescription: '查看 Baseline策略 的完整规则、边界说明与样本 ETF 回测结果。',
    sections: CONFIRM_TRAIL12_METHOD_SECTIONS,
    backtestSource: CONFIRM_TRAIL12_BACKTEST_SOURCE,
    backtestAggregate: CONFIRM_TRAIL12_BACKTEST_AGGREGATE,
    backtestRows: CONFIRM_TRAIL12_BACKTEST_ROWS,
    signalLegend: [
      { key: 'buy', tone: 'buy', text: '红色向上箭头：绿转黄且收盘价不低于 SMA250' },
      { key: 'confirm-sell', tone: 'sell', text: '绿色向下箭头：黄转绿，且 close<SMA20 / MACD Hist<0 / RSI<50 任一成立' },
      { key: 'risk-sell', tone: 'risk', text: '金色向下箭头：持仓后相对高点回撤达到 12%' },
      { key: 'turnover', tone: 'turnover', text: '淡紫圆点：成交额 >= 前20日均值 1.50x' },
    ],
  },
  {
    id: 'baseColorFlip',
    label: '基础颜色切换',
    shortLabel: '绿转黄买 / 黄转绿卖',
    roleLabel: '对照策略',
    selectorDescription: '只保留颜色切换本身，不加趋势过滤与风控确认，适合和默认策略做直观对照。',
    signalPreset: 'baseColorFlip',
    summaryLines: BASE_COLOR_FLIP_SUMMARY_LINES,
    methodTitle: '基础颜色切换 分析方法',
    methodLeadParagraphs: [
      '本页归档“基础颜色切换”策略的说明口径，用来解释最原始的价格分段切换信号如何映射到主图买卖点，以及它与默认策略相比少了哪些确认与风控过滤。',
      '页面仍沿用统一的方法说明版式，但该策略当前定位为对照口径，因此研究结果部分优先展示实现边界与后续扩展位，而不是强行补齐未完成的回测归档。',
    ],
    methodCtaDescription: '查看颜色切换口径、适用边界与当前实现说明。',
    sections: BASE_COLOR_FLIP_METHOD_SECTIONS,
    backtestSource: '当前仅完成图表对照接入，尚未沉淀独立样本 ETF 回测表；后续可在同一注册表下直接补充。',
    signalLegend: [
      { key: 'buy', tone: 'buy', text: '红色向上箭头：价格线由绿转黄' },
      { key: 'sell', tone: 'sell', text: '绿色向下箭头：价格线由黄转绿' },
      { key: 'turnover', tone: 'turnover', text: '淡紫圆点：成交额 >= 前20日均值 1.50x' },
    ],
  },
] as const

const MOMENTUM_STRATEGY_MAP = new Map<MomentumStrategyId, MomentumStrategyDefinition>(
  MOMENTUM_STRATEGIES.map((strategy) => [strategy.id, strategy]),
)

export function isMomentumStrategyId(value: string | null | undefined): value is MomentumStrategyId {
  return value === 'confirmTrail12' || value === 'baseColorFlip'
}

export function resolveMomentumStrategyId(value: string | null | undefined): MomentumStrategyId {
  return isMomentumStrategyId(value) ? value : DEFAULT_MOMENTUM_STRATEGY_ID
}

export function getMomentumStrategy(value: string | null | undefined): MomentumStrategyDefinition {
  const id = resolveMomentumStrategyId(value)
  return MOMENTUM_STRATEGY_MAP.get(id) ?? MOMENTUM_STRATEGY_MAP.get(DEFAULT_MOMENTUM_STRATEGY_ID)!
}

export function buildMomentumMethodPath(value: string | null | undefined): string {
  const params = new URLSearchParams()
  params.set('strategy', resolveMomentumStrategyId(value))
  return `${MOMENTUM_METHOD_PATH}?${params.toString()}`
}

export function buildMomentumAnalysisPath(args?: { strategyId?: string | null; ticker?: string | null }): string {
  const params = new URLSearchParams()
  params.set('strategy', resolveMomentumStrategyId(args?.strategyId))
  const ticker = String(args?.ticker || '').trim()
  if (ticker) params.set('ticker', ticker)
  return `${MOMENTUM_ANALYSIS_PATH}?${params.toString()}`
}

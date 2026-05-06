import {
  __resetRpsStyleReadCacheForTest,
  getRpsSignalSeries,
  getRpsCustomQuery,
} from '../lib/rpsStyle.js'
import { buildMomentumSignalsByStrategy, type MomentumSignalSnapshot } from '../../src/utils/momentumSignalSnapshot.js'
import { MOMENTUM_STRATEGIES } from '../../src/utils/momentumStrategies.js'

const TICKER = '518800.SH'
const END_DATE = '2026-05-06'

async function main() {
  __resetRpsStyleReadCacheForTest()
  console.log('📦 路径1: TOP200 (getRpsSignalSeries)...')
  const s1 = await getRpsSignalSeries({ ticker: TICKER, endDate: END_DATE })

  __resetRpsStyleReadCacheForTest()
  console.log('📦 路径2: 动量分析 (getRpsCustomQuery)...')
  const s2 = await getRpsCustomQuery({ ticker: TICKER, endDate: END_DATE })

  const series1 = s1.data.series
  const series2 = s2.data.series

  console.log('\n' + '='.repeat(80))
  console.log('📊 对比结果')
  console.log('='.repeat(80))
  console.log(`路径1 dataDate: ${s1.meta.dataDate}  |  series长度: ${series1.length}`)
  console.log(`路径2 dataDate: ${s2.meta.dataDate}  |  series长度: ${series2.length}`)

  const tailLen = 30
  console.log(`\n--- 尾部 ${tailLen} 日对比 (⚠️=有差异) ---`)
  console.log('日期           | 路径1 close     bmk        score    | 路径2 close     bmk        score')
  console.log('-'.repeat(100))

  const tail1 = series1.slice(-tailLen)
  const tail2 = series2.slice(-tailLen)
  let tailMismatch = 0
  const n = Math.max(tail1.length, tail2.length)
  for (let i = 0; i < n; i++) {
    const p1 = tail1[i]
    const p2 = tail2[i]
    const d1 = p1?.date ?? '---'
    const d2 = p2?.date ?? '---'
    const c1 = p1?.targetCloseQfq?.toFixed(4) ?? '---'
    const c2 = p2?.targetCloseQfq?.toFixed(4) ?? '---'
    const b1 = p1?.benchmarkCloseQfq?.toFixed(4) ?? '---'
    const b2 = p2?.benchmarkCloseQfq?.toFixed(4) ?? '---'
    const sc1 = typeof p1?.scorePct === 'number' ? p1.scorePct.toFixed(2) : '---'
    const sc2 = typeof p2?.scorePct === 'number' ? p2.scorePct.toFixed(2) : '---'
    const same = d1 === d2 && c1 === c2 && b1 === b2 && sc1 === sc2
    const flag = same ? '  ' : '⚠️'
    if (!same) tailMismatch++
    console.log(`${flag} ${d1.padEnd(14)} ${c1.padEnd(10)} ${b1.padEnd(10)} ${sc1.padEnd(8)} | ${d2.padEnd(14)} ${c2.padEnd(10)} ${b2.padEnd(10)} ${sc2.padEnd(8)}`)
  }
  console.log(`尾部差异行数: ${tailMismatch}`)

  let fullMismatch = 0
  const maxLen = Math.max(series1.length, series2.length)
  for (let i = 0; i < maxLen; i++) {
    const p1 = series1[i]
    const p2 = series2[i]
    if (!p1 || !p2) { fullMismatch++; continue }
    if (p1.date !== p2.date || p1.targetCloseQfq !== p2.targetCloseQfq || p1.benchmarkCloseQfq !== p2.benchmarkCloseQfq || p1.scorePct !== p2.scorePct) {
      fullMismatch++
    }
  }
  console.log(`全量差异行数: ${fullMismatch}`)

  console.log('\n--- 信号对比 (Baseline = confirmTrail12) ---')
  const strategies = MOMENTUM_STRATEGIES.map(s => ({ id: s.id, signalPreset: s.signalPreset }))

  const sig1 = buildMomentumSignalsByStrategy({ series: series1, strategies, referenceDate: s1.meta.dataDate })
  const sig2 = buildMomentumSignalsByStrategy({ series: series2, strategies, referenceDate: s2.meta.dataDate })

  for (const [key] of Object.entries(sig1)) {
    const a = sig1[key] as MomentumSignalSnapshot
    const b = sig2[key] as MomentumSignalSnapshot
    const same = a.signalKey === b.signalKey && a.signalDate === b.signalDate && a.freshnessLabel === b.freshnessLabel
    console.log(`  ${key}:`)
    console.log(`    路径1 → ${a.signalKey || '-'}  ${a.signalDate || '-'}  新鲜度=${a.freshnessLabel || '-'}`)
    console.log(`    路径2 → ${b.signalKey || '-'}  ${b.signalDate || '-'}  新鲜度=${b.freshnessLabel || '-'}`)
    console.log(`    一致: ${same ? '✅' : '❌'}`)
  }

  console.log('\n' + '='.repeat(80))
  if (fullMismatch === 0) {
    console.log('✅ 底层序列完全一致')
    console.log('→ 信号差异来自 referenceDate/新鲜度计算（prepareMomentumPoints 过滤 + effectiveDataDate 截断）')
  } else {
    console.log('❌ 底层序列存在差异')
    console.log('→ 两次获取间东方财富返回了不同数据，或缓存未正确清理')
  }
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})

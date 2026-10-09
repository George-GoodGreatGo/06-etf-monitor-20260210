import 'dotenv/config'
import { US_STYLE_BENCHMARK, US_STYLE_TARGETS } from '../../src/utils/usMarketStyle.js'
import { buildUsStyleSnapshot, fetchUsAdjustedCloses, newYorkDate, parseYahooAdjustedCloses, publishUsStyleSnapshot, type AdjustedClose } from '../lib/usMarketStyle.js'

async function main() {
  const now = new Date()
  const prices: Record<string, AdjustedClose[]> = {}
  const inputIndex = process.argv.indexOf('--input')
  const inputDirIndex = process.argv.indexOf('--input-dir')
  let imported: Record<string, unknown> | null = null
  if (inputIndex >= 0) {
    const { readFile } = await import('node:fs/promises')
    if (!process.argv[inputIndex + 1]) throw new Error('Missing --input file path')
    imported = JSON.parse(await readFile(process.argv[inputIndex + 1], 'utf8'))
  }
  for (const ticker of [US_STYLE_BENCHMARK, ...US_STYLE_TARGETS.map((x) => x.ticker)]) {
    let payload = imported?.[ticker]
    if (inputDirIndex >= 0) {
      const { readFile } = await import('node:fs/promises')
      const { join } = await import('node:path')
      if (!process.argv[inputDirIndex + 1]) throw new Error('Missing --input-dir path')
      payload = JSON.parse((await readFile(join(process.argv[inputDirIndex + 1], `${ticker}.local.json`), 'utf8')).replace(/^\uFEFF/, ''))
    }
    if (payload && (payload as { chart?: { result?: Array<{ meta?: { symbol?: string } }> } }).chart?.result?.[0]?.meta?.symbol !== ticker) {
      throw new Error(`Unexpected imported symbol for ${ticker}`)
    }
    prices[ticker] = payload ? parseYahooAdjustedCloses(payload, newYorkDate(now)) : await fetchUsAdjustedCloses(ticker, now)
    console.log(`[us-style] ${ticker}: ${prices[ticker].length} adjusted sessions`)
  }
  const snapshot = buildUsStyleSnapshot(prices, now)
  const outputIndex = process.argv.indexOf('--output')
  if (outputIndex >= 0) {
    const { writeFile } = await import('node:fs/promises')
    if (!process.argv[outputIndex + 1]) throw new Error('Missing --output file path')
    await writeFile(process.argv[outputIndex + 1], JSON.stringify(snapshot), 'utf8')
  }
  if (process.argv.includes('--dry-run')) {
    const { buildUsPercentileSeries } = await import('../../src/utils/usMarketStyle.js')
    console.log(JSON.stringify({ dataDate: snapshot.dataDate, items: snapshot.items,
      historicalMomentum: Object.fromEntries(Object.entries(snapshot.seriesByTicker).map(([ticker, series]) => {
        const prepared = buildUsPercentileSeries(series)
        const latest = prepared[prepared.length - 1]
        return [ticker, { percentile: latest.percentile, sampleCount: latest.historyCount,
          cold: latest.historicalCold, hot: latest.historicalHot }]
      })) }, null, 2))
    return
  }
  await publishUsStyleSnapshot(snapshot)
  console.log(`[us-style] published all ${US_STYLE_TARGETS.length} targets, dataDate=${snapshot.dataDate}`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import('node:fs/promises')
    await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `## US Market Style\n\nPublished ${snapshot.dataDate} (New York session), benchmark ${US_STYLE_BENCHMARK}, ${US_STYLE_TARGETS.length} targets.\n`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})

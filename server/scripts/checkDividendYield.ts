import { getLowVolH30269Series } from '../lib/lowVol.js';

async function main() {
  const data = await getLowVolH30269Series();
  const series = data.data.series.filter(s => s.date >= '2024-01-01' && s.date <= '2024-12-31');
  console.log("Date | PRI | divYieldPct");
  for (let i = 0; i < series.length; i += 10) {
    const s = series[i];
    console.log(`${s.date} | ${s.close.toFixed(2)} | ${s.dividendYieldPct?.toFixed(4)}`);
  }
}
main().catch(console.error);

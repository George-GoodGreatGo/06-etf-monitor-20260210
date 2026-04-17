import assert from "node:assert/strict"
import { fetchGovBond10yYieldPctByDateWithFallbackSafe } from "../../../../server/lib/chinamoneyGovBond.ts"

const originalFetch = globalThis.fetch
const mockFetch = async (url) => {
  const u = String(url || "")
  if (u.includes("yield.chinabond.com.cn")) {
    return new Response("<html><title>504</title></html>", {
      status: 504,
      headers: { "content-type": "text/html" },
    })
  }
  return new Response("{}", {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

process.env.CHINAMONEY_FETCH_MAX_ATTEMPTS = "1"
process.env.CHINAMONEY_FETCH_BASE_DELAY_MS = "0"
process.env.CHINAMONEY_FETCH_BUDGET_MS = "15000"
globalThis.fetch = mockFetch

try {
  process.env.BAO_MOCK_MODE = "success"
  const s1 = await fetchGovBond10yYieldPctByDateWithFallbackSafe({ year: 2024, cacheTtlMs: 0 })
  assert.equal(s1.error, null)
  assert.equal(s1.source, "baostock")
  assert.equal(s1.fallbackUsed, true)
  assert.ok(s1.map.size > 0)

  process.env.BAO_MOCK_MODE = "fail"
  const s2 = await fetchGovBond10yYieldPctByDateWithFallbackSafe({ year: 2025, cacheTtlMs: 0 })
  assert.equal(s2.map.size, 0)
  assert.equal(s2.source, null)
  assert.equal(s2.fallbackUsed, false)
  assert.ok(typeof s2.error === "string" && s2.error.includes("chinamoney_failed"))
  assert.ok(
    typeof s2.error === "string" &&
      (s2.error.includes("baostock_failed") || s2.error.includes("baostock_empty")),
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        case1: {
          fallbackUsed: s1.fallbackUsed,
          source: s1.source,
          points: s1.map.size,
        },
        case2: {
          fallbackUsed: s2.fallbackUsed,
          source: s2.source,
          error: s2.error,
        },
      },
      null,
      2,
    ),
  )
} finally {
  globalThis.fetch = originalFetch
}

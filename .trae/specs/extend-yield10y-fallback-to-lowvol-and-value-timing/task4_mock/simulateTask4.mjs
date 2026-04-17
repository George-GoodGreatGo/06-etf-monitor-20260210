import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { fetchGovBond10yYieldPctByDateWithFallbackSafe } from "../../../../server/lib/chinamoneyGovBond.ts"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "../../../../")

const lowVolFile = path.join(projectRoot, "server/scripts/refreshLowVolSnapshots.ts")
const valueFile = path.join(projectRoot, "server/scripts/refreshValueTimingSnapshots.ts")
const lowVolLibFile = path.join(projectRoot, "server/lib/lowVol.ts")
const valueLibFile = path.join(projectRoot, "server/lib/valueTiming.ts")

const originalFetch = globalThis.fetch
const originalPyPath = process.env.PYTHONPATH

const mockFetch = async (url) => {
  const u = String(url || "")
  if (u.includes("yield.chinabond.com.cn")) {
    // Simulate chinamoney timeout/html failure.
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

function assertPublishGuard(scriptSource, scriptName) {
  assert.ok(
    scriptSource.includes("if (!series.length) throw new Error"),
    `${scriptName} should stop on empty series`,
  )
  assert.ok(
    scriptSource.includes("coverage failed"),
    `${scriptName} should stop on low coverage (incomplete result)`,
  )
  assert.ok(
    scriptSource.includes("if (prevVisible)"),
    `${scriptName} should keep previous visible run on failure`,
  )
  assert.ok(
    scriptSource.includes("nextRunId: prevVisible"),
    `${scriptName} should not publish the failed/incomplete run`,
  )
}

function assertFallbackWireup(source, fileName) {
  assert.ok(
    source.includes("fetchGovBond10yYieldPctByDateWithFallbackSafe"),
    `${fileName} should use shared chinamoney+baostock fallback helper`,
  )
}

process.env.CHINAMONEY_FETCH_MAX_ATTEMPTS = "1"
process.env.CHINAMONEY_FETCH_BASE_DELAY_MS = "0"
process.env.CHINAMONEY_FETCH_BUDGET_MS = "15000"
process.env.PYTHONPATH = __dirname
globalThis.fetch = mockFetch

try {
  const lowVolSrc = fs.readFileSync(lowVolFile, "utf-8")
  const valueSrc = fs.readFileSync(valueFile, "utf-8")
  assertPublishGuard(lowVolSrc, "refreshLowVolSnapshots.ts")
  assertPublishGuard(valueSrc, "refreshValueTimingSnapshots.ts")

  const lowVolLibSrc = fs.readFileSync(lowVolLibFile, "utf-8")
  const valueLibSrc = fs.readFileSync(valueLibFile, "utf-8")
  assertFallbackWireup(lowVolLibSrc, "lowVol.ts")
  assertFallbackWireup(valueLibSrc, "valueTiming.ts")

  process.env.BAO_MOCK_MODE = "success"
  const fallbackOk = await fetchGovBond10yYieldPctByDateWithFallbackSafe({
    year: 2024,
    cacheTtlMs: 0,
  })
  assert.equal(fallbackOk.error, null)
  assert.equal(fallbackOk.source, "baostock")
  assert.equal(fallbackOk.fallbackUsed, true)
  assert.ok(fallbackOk.map.size > 0)

  process.env.BAO_MOCK_MODE = "fail"
  const fallbackFail = await fetchGovBond10yYieldPctByDateWithFallbackSafe({
    year: 2025,
    cacheTtlMs: 0,
  })
  assert.equal(fallbackFail.map.size, 0)
  assert.equal(fallbackFail.source, null)
  assert.equal(fallbackFail.fallbackUsed, false)
  assert.ok(
    typeof fallbackFail.error === "string" &&
      fallbackFail.error.includes("chinamoney_failed"),
  )
  assert.ok(
    typeof fallbackFail.error === "string" &&
      (fallbackFail.error.includes("baostock_failed") ||
        fallbackFail.error.includes("baostock_empty")),
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        fallback_timeout_case: {
          source: fallbackOk.source,
          fallbackUsed: fallbackOk.fallbackUsed,
          points: fallbackOk.map.size,
        },
        both_sources_failed_case: {
          source: fallbackFail.source,
          fallbackUsed: fallbackFail.fallbackUsed,
          error: fallbackFail.error,
          publishGuardsVerified: {
            lowVol: true,
            valueTiming: true,
          },
        },
      },
      null,
      2,
    ),
  )
} finally {
  globalThis.fetch = originalFetch
  if (originalPyPath == null) delete process.env.PYTHONPATH
  else process.env.PYTHONPATH = originalPyPath
}

import { fetchChinabond10yYearMap } from './riskfree10yProviders/chinabond.js'

export async function fetchGovBond10yYieldPctByDate(input: {
  year: number
  cacheTtlMs?: number
}): Promise<Map<string, number>> {
  void input.cacheTtlMs
  return await fetchChinabond10yYearMap(input.year)
}

export async function fetchGovBond10yYieldPctByDateSafe(input: {
  year: number
  cacheTtlMs?: number
}): Promise<{ map: Map<string, number>; error: string | null }> {
  try {
    const map = await fetchGovBond10yYieldPctByDate(input)
    return { map, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { map: new Map<string, number>(), error: msg || 'unknown_error' }
  }
}

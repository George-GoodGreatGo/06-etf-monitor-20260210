import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')

async function readMigration(relativePath: string): Promise<string> {
  return await readFile(path.join(repoRoot, relativePath), 'utf-8')
}

function assertContainsAll(content: string, expectedSnippets: string[]): void {
  for (const snippet of expectedSnippets) {
    assert.ok(content.includes(snippet), `Expected snippet not found: ${snippet}`)
  }
}

const publishMarketBoardSql = await readMigration('supabase/migrations/0009_market_board_publish_run_rpc.sql')
assertContainsAll(publishMarketBoardSql, [
  'security definer',
  'set search_path = public',
  'revoke execute on function public.publish_market_board_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;',
  'grant execute on function public.publish_market_board_run(text, text, jsonb, date, text, jsonb) to service_role;',
])

const publishLowvolSql = await readMigration('supabase/migrations/0011_lowvol_run_model.sql')
assertContainsAll(publishLowvolSql, [
  'security definer',
  'set search_path = public',
  'revoke execute on function public.publish_lowvol_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;',
  'grant execute on function public.publish_lowvol_run(text, text, jsonb, date, text, jsonb) to service_role;',
])

const publishValueTimingSql = await readMigration('supabase/migrations/0012_value_timing_run_model.sql')
assertContainsAll(publishValueTimingSql, [
  'security definer',
  'set search_path = public',
  'revoke execute on function public.publish_value_timing_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;',
  'grant execute on function public.publish_value_timing_run(text, text, jsonb, date, text, jsonb) to service_role;',
])

const publishRpsSql = await readMigration('supabase/migrations/0013_rps_run_model.sql')
assertContainsAll(publishRpsSql, [
  'security definer',
  'set search_path = public',
  'revoke execute on function public.publish_rps_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;',
  'grant execute on function public.publish_rps_run(text, text, jsonb, date, text, jsonb) to service_role;',
])

const recentSearchSql = await readMigration('supabase/migrations/0015_rps_custom_recent_search.sql')
assertContainsAll(recentSearchSql, [
  'security definer',
  'set search_path = public',
  'revoke execute on function public.upsert_rps_custom_recent_search(text, text, text, text, integer) from public, anon, authenticated;',
  'grant execute on function public.upsert_rps_custom_recent_search(text, text, text, text, integer) to service_role;',
])

const hardeningSql = await readMigration('supabase/migrations/0018_harden_supabase_security_warnings.sql')
assertContainsAll(hardeningSql, [
  'create or replace function public.set_updated_at()',
  'returns trigger',
  'set search_path = public',
  'revoke execute on function public.publish_market_board_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;',
  'grant execute on function public.publish_market_board_run(text, text, jsonb, date, text, jsonb) to service_role;',
  'revoke execute on function public.publish_lowvol_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;',
  'grant execute on function public.publish_lowvol_run(text, text, jsonb, date, text, jsonb) to service_role;',
  'revoke execute on function public.publish_value_timing_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;',
  'grant execute on function public.publish_value_timing_run(text, text, jsonb, date, text, jsonb) to service_role;',
  'revoke execute on function public.publish_rps_run(text, text, jsonb, date, text, jsonb) from public, anon, authenticated;',
  'grant execute on function public.publish_rps_run(text, text, jsonb, date, text, jsonb) to service_role;',
  'revoke execute on function public.upsert_rps_custom_recent_search(text, text, text, text, integer) from public, anon, authenticated;',
  'grant execute on function public.upsert_rps_custom_recent_search(text, text, text, text, integer) to service_role;',
])

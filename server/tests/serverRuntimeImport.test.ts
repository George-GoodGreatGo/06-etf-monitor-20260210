import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = process.cwd()
const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
assert.equal(config.error, undefined)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
const outDir = path.join(root, 'node_modules', '.tmp', 'server-runtime-import')
const program = ts.createProgram([path.join(root, 'api/index.ts')], {
  ...parsed.options, noEmit: false, allowImportingTsExtensions: false,
  rootDir: root, outDir, incremental: false, tsBuildInfoFile: undefined,
})
const diagnostics = ts.getPreEmitDiagnostics(program)
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: (file) => file,
  getCurrentDirectory: () => root,
  getNewLine: () => '\n',
}))
assert.equal(program.emit().emitSkipped, false)
const appUrl = pathToFileURL(path.join(outDir, 'server/app.js')).href
const entryUrl = pathToFileURL(path.join(outDir, 'api/index.js')).href
const script = `
  const entry = await import(${JSON.stringify(entryUrl)});
  if (typeof entry.default !== 'function') throw new Error('Invalid deployment entry');
  const { default: app } = await import(${JSON.stringify(appUrl)});
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  await new Promise(resolve => setImmediate(resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const health = await fetch(base + '/api/health');
    if (health.status !== 200 || !(await health.json()).success) throw new Error('Health failed');
    const login = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    if (login.status !== 400) throw new Error('Login handler failed to load');
    console.log('Compiled ESM entry, health and login handler passed');
  } finally { await new Promise(resolve => server.close(resolve)); }
`
const env = { ...process.env }
delete env.SUPABASE_URL
delete env.SUPABASE_SERVICE_ROLE_KEY
delete env.SUPABASE_ANON_KEY
const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
  cwd: outDir, env, encoding: 'utf8', timeout: 30_000,
})
assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
assert.match(result.stderr, /Admin initialization failed/)
console.log(result.stdout.trim())

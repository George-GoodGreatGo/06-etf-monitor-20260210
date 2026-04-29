const fs = require('fs');
let c = fs.readFileSync('src/pages/Home.tsx', 'utf-8');
// Normalize to LF for matching
c = c.replace(/\r\n/g, '\n');

// 1. Fix import
c = c.replace('import { Loader2, ChevronUp, ChevronDown } from', 'import { ChevronUp, ChevronDown } from');

// 2. Remove adminNotice + adminRefreshing state declarations
c = c.replace(
  "  const [adminNotice, setAdminNotice] = useState<{ tone: 'info' | 'warn'; message: string } | null>(null)\n  const [adminRefreshing, setAdminRefreshing] = useState(false)\n\n",
  ''
);

// 3. Remove activeRefetchTokenKey
c = c.replace("  const activeRefetchTokenKey = 'etf_monitor_active_refetch_token'\n\n", '');

// 4. Remove isVercelBackend state + blank line
c = c.replace('  const [isVercelBackend, setIsVercelBackend] = useState<boolean | null>(null)\n\n', '');

// 5. Remove health check useEffect
const hIdx = c.indexOf("apiUrl('/api/health')");
if (hIdx > 0) {
  let start = c.lastIndexOf('useEffect', hIdx);
  start = c.lastIndexOf('\n', start) + 1;
  let depth = 0, started = false, end = start;
  for (let i = start; i < c.length; i++) {
    if (c[i] === '{') { depth++; started = true; }
    if (c[i] === '}') { depth--; }
    if (started && depth === 0) { end = i + 1; break; }
  }
  while (end < c.length && c[end] !== '\n') end++;
  if (end < c.length) end++;
  c = c.slice(0, start) + c.slice(end);
}

// 6. Remove onRefetch function
const onRefIdx = c.indexOf('\n  const onRefetch = () => {');
if (onRefIdx > 0) {
  const lowVolIdx = c.indexOf('const lowVolActiveOpt = LOWVOL_INDEX_OPTIONS.find', onRefIdx);
  if (lowVolIdx > 0) {
    let beforeLowVol = c.lastIndexOf('\n', lowVolIdx - 2);
    c = c.slice(0, onRefIdx + 1) + c.slice(beforeLowVol + 1);
  }
}

// 7. Fix top200Refetching
c = c.replace('const top200Refetching = adminRefreshing || (loading && (loadingMode === ', 'const top200Refetching = (loading && (loadingMode === ');

// 8. Remove refetch button
const btnStart = c.indexOf('<button\n                type="button"\n                onClick={onRefetch}');
if (btnStart > 0) {
  const btnEnd = c.indexOf('</button>\n', btnStart);
  if (btnEnd > 0) {
    c = c.slice(0, btnStart) + c.slice(btnEnd + '</button>\n'.length);
  }
}

// 9. Remove notice={adminNotice}
c = c.replace('            notice={adminNotice}\n', '');

// 10. Remove init useEffect localStorage recovery
c = c.replace(
  "    const activeRefetchToken = window.localStorage.getItem(activeRefetchTokenKey)\n    if (activeRefetchToken && /^\\d+$/.test(activeRefetchToken)) {\n      const startedAt = Number(activeRefetchToken)\n      const maxAgeMs = 20 * 60_000\n      if (Number.isFinite(startedAt) && Date.now() - startedAt < maxAgeMs) {\n        void runFetch(seq, { mode: 'refetch', refreshToken: activeRefetchToken })\n        return\n      }\n      window.localStorage.removeItem(activeRefetchTokenKey)\n    }\n\n",
  ''
);

// 11. Remove localStorage cleanup in runFetch
c = c.replace(
  "      if (mode === 'refetch' && opts?.refreshToken) {\n        const active = window.localStorage.getItem(activeRefetchTokenKey)\n        if (active && active === opts.refreshToken) {\n          window.localStorage.removeItem(activeRefetchTokenKey)\n        }\n      }\n",
  ''
);
c = c.replace(
  "      if (mode === 'refetch' && opts?.refreshToken) {\n        const active = window.localStorage.getItem(activeRefetchTokenKey)\n        if (active && active === opts.refreshToken) {\n          window.localStorage.removeItem(activeRefetchTokenKey)\n        }\n      }\n",
  ''
);

// Restore CRLF
c = c.replace(/\n/g, '\r\n');
fs.writeFileSync('src/pages/Home.tsx', c, 'utf-8');
console.log('DONE');

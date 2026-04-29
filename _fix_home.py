import os

with open('src/pages/Home.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix import
content = content.replace(
    'import { Loader2, ChevronUp, ChevronDown } from',
    'import { ChevronUp, ChevronDown } from'
)

# 2. Remove adminNotice + adminRefreshing state + trailing blank
old = "  const [adminNotice, setAdminNotice] = useState<{ tone: 'info' | 'warn'; message: string } | null>(null)\r\n  const [adminRefreshing, setAdminRefreshing] = useState(false)\r\n\r\n"
content = content.replace(old, '')

# 3. Remove activeRefetchTokenKey
old2 = "  const activeRefetchTokenKey = 'etf_monitor_active_refetch_token'\r\n\r\n"
content = content.replace(old2, '')

# 4. Remove isVercelBackend
old3 = '  const [isVercelBackend, setIsVercelBackend] = useState<boolean | null>(null)\r\n\r\n'
content = content.replace(old3, '')

# 5. Remove health check useEffect (from useEffect to closing },[])
index = content.find("apiUrl('/api/health')")
if index > 0:
    # Find the start of this useEffect
    start = content.rfind('useEffect', 0, index)
    start = content.rfind('\n', 0, start) + 1  # beginning of line with useEffect
    # Find closing },[]) - search for the pattern after the useEffect block
    depth = 0
    started = False
    for i in range(start, len(content)):
        if content[i] == '{':
            depth += 1
            started = True
        elif content[i] == '}':
            depth -= 1
        if started and depth == 0:
            # Find the }, []) ending
            end = i + 1
            # eat whitespace and newlines
            while end < len(content) and content[end] in ' \r\n,])':
                end += 1
            content = content[:start] + content[end:]
            break

# 6. Remove localStorage cleanup in runFetch success handler
# Pattern: "if (mode === 'refetch' && opts?.refreshToken) {\n        const active = ..."
content = content.replace(
    "      if (mode === 'refetch' && opts?.refreshToken) {\r\n        const active = window.localStorage.getItem(activeRefetchTokenKey)\r\n        if (active && active === opts.refreshToken) {\r\n          window.localStorage.removeItem(activeRefetchTokenKey)\r\n        }\r\n      }\r\n",
    ''
)
content = content.replace(
    "      if (mode === 'refetch' && opts?.refreshToken) {\r\n        const active = window.localStorage.getItem(activeRefetchTokenKey)\r\n        if (active && active === opts.refreshToken) {\r\n          window.localStorage.removeItem(activeRefetchTokenKey)\r\n        }\r\n      }\r\n",
    ''
)

# 7. Remove localStorage init in first useEffect  
old_init = "    const activeRefetchToken = window.localStorage.getItem(activeRefetchTokenKey)\r\n    if (activeRefetchToken && /^\\d+$/.test(activeRefetchToken)) {\r\n      const startedAt = Number(activeRefetchToken)\r\n      const maxAgeMs = 20 * 60_000\r\n      if (Number.isFinite(startedAt) && Date.now() - startedAt < maxAgeMs) {\r\n        void runFetch(seq, { mode: 'refetch', refreshToken: activeRefetchToken })\r\n        return\r\n      }\r\n      window.localStorage.removeItem(activeRefetchTokenKey)\r\n    }\r\n\r\n"
content = content.replace(old_init, '')

with open('src/pages/Home.tsx', 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print("Phase 2 done")

// Per-process memory only. Errors are never cached and concurrent reads share one load.
export function createAsyncSnapshotCache<T>(options: {
  ttlMs: number
  load: () => Promise<T>
  key?: () => string
  cacheable?: (value: T) => boolean
  now?: () => number
}) {
  let cached: { key: string; expiresAt: number; value: T } | null = null
  let inflight: { key: string; promise: Promise<T> } | null = null
  const now = options.now || Date.now
  return {
    get(force = false): Promise<T> {
      const key = options.key?.() || 'default'
      if (inflight?.key === key) return inflight.promise
      if (!force && cached?.key === key && cached.expiresAt > now()) return Promise.resolve(cached.value)
      const promise = Promise.resolve().then(options.load).then((value) => {
        if (inflight?.promise === promise) {
          cached = options.cacheable?.(value) === false ? null : { key, expiresAt: now() + options.ttlMs, value }
        }
        return value
      }).catch((error: unknown) => {
        if (inflight?.promise === promise) cached = null
        throw error
      }).finally(() => {
        if (inflight?.promise === promise) inflight = null
      })
      inflight = { key, promise }
      return promise
    },
  }
}

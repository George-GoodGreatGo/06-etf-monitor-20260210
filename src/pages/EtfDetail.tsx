import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Construction, Info } from 'lucide-react'
import NavBar from '@/components/NavBar'
import DataStatusBanner from '@/components/DataStatusBanner'
import EtfWeeklyChart from '@/components/charts/EtfWeeklyChart'
import ZBadge from '@/components/ZBadge'
import {
  type EtfDetail,
  type EtfWeeklyChart as EtfWeeklyChartData,
  fetchEtfDetail,
  fetchEtfWeeklyChart,
  type Top100Meta,
} from '@/utils/etfApi'
import { formatYmd } from '@/utils/format'

export default function EtfDetail() {
  const { code } = useParams()
  const [searchParams] = useSearchParams()
  const backUrl = `/?${searchParams.toString()}`

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<Top100Meta | null>(null)
  const [data, setData] = useState<EtfDetail | null>(null)

  const [weeklyLoading, setWeeklyLoading] = useState(true)
  const [weeklyError, setWeeklyError] = useState<string | null>(null)
  const [weeklyMeta, setWeeklyMeta] = useState<Top100Meta | null>(null)
  const [weeklyData, setWeeklyData] = useState<EtfWeeklyChartData | null>(null)

  useEffect(() => {
    if (!code) return
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchEtfDetail(code, ac.signal)
        if (res.success === false) {
          setMeta(null)
          setData(null)
          setError(res.message ?? res.error)
          setLoading(false)
          return
        }
        setMeta(res.meta)
        setData(res.data)
        setLoading(false)
      } catch (e) {
        const name =
          typeof e === 'object' && e && 'name' in e
            ? String((e as { name: unknown }).name)
            : ''
        if (name === 'AbortError') return
        setMeta(null)
        setData(null)
        setError('网络异常或 API 不可用')
        setLoading(false)
      }
    })()
    return () => ac.abort()
  }, [code])

  useEffect(() => {
    if (!code) return
    const ac = new AbortController()
    ;(async () => {
      setWeeklyLoading(true)
      setWeeklyError(null)
      try {
        const res = await fetchEtfWeeklyChart(code, ac.signal)
        if (res.success === false) {
          setWeeklyMeta(null)
          setWeeklyData(null)
          setWeeklyError(res.message ?? res.error)
          setWeeklyLoading(false)
          return
        }
        setWeeklyMeta(res.meta)
        setWeeklyData(res.data)
        setWeeklyLoading(false)
      } catch (e) {
        const name =
          typeof e === 'object' && e && 'name' in e
            ? String((e as { name: unknown }).name)
            : ''
        if (name === 'AbortError') return
        setWeeklyMeta(null)
        setWeeklyData(null)
        setWeeklyError('网络异常或 API 不可用')
        setWeeklyLoading(false)
      }
    })()
    return () => ac.abort()
  }, [code])

  return (
    <div>
      <NavBar
        rightMeta={
          meta
            ? {
                fetchedAt: meta.cachedAt || meta.fetchedAt,
                dataDate: meta.dataDate,
              }
            : undefined
        }
      />

      <main className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <Link
            to={backUrl}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:border-white/20 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            返回 Top100
          </Link>
        </div>

        <DataStatusBanner
          loading={loading}
          error={error}
          meta={meta}
          incompleteCount={0}
          onRetry={() => {
            if (!code) return
            const ac = new AbortController()
            setLoading(true)
            setError(null)
            fetchEtfDetail(code, ac.signal)
              .then((res) => {
                if (res.success === false) {
                  setMeta(null)
                  setData(null)
                  setError(res.message ?? res.error)
                  setLoading(false)
                  return
                }
                setMeta(res.meta)
                setData(res.data)
                setLoading(false)
              })
              .catch((e) => {
                const name =
                  typeof e === 'object' && e && 'name' in e
                    ? String((e as { name: unknown }).name)
                    : ''
                if (name === 'AbortError') return
                setMeta(null)
                setData(null)
                setError('网络异常或 API 不可用')
                setLoading(false)
              })
          }}
        />

        <section className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#111B2E] p-4 md:col-span-2">
            <div className="text-xs text-[#A9B6CC]">ETF</div>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">
              <span className="font-mono">{code}</span>{' '}
              <span className="text-[#A9B6CC]">{data?.name ?? '—'}</span>
            </h1>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-[#A9B6CC]">最新完整交易日</div>
                <div className="mt-1 font-mono text-sm">
                  {formatYmd(data?.latestTradingDate)}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-[#A9B6CC]">90 日成交额 Z 值</div>
                <div className="mt-1">
                  <ZBadge
                    z={data?.z90 ?? null}
                    status={error ? 'api_error' : 'complete'}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-[#A9B6CC]">说明</div>
                <div className="mt-1 text-xs text-[#A9B6CC]">
                  当前页面为占位，后续逐步补充更多指标
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#111B2E] p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 text-[#A9B6CC]" />
              <div>
                <div className="text-sm font-medium">数据约束</div>
                <div className="mt-1 text-xs text-[#A9B6CC]">
                  仅展示完整交易日数据；缺失/失败不补全、不杜撰。
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Link
                to="/methodology"
                className="inline-flex items-center gap-2 text-xs text-[#A9B6CC] hover:text-[#E6EDF7]"
              >
                查看数据与方法说明 →
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-white/10 bg-[#111B2E] p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">周线图表</div>
          </div>

          <div className="mt-3">
            <DataStatusBanner
              loading={weeklyLoading}
              error={weeklyError}
              meta={weeklyMeta}
              incompleteCount={0}
              onRetry={() => {
                if (!code) return
                const ac = new AbortController()
                setWeeklyLoading(true)
                setWeeklyError(null)
                fetchEtfWeeklyChart(code, ac.signal)
                  .then((res) => {
                    if (res.success === false) {
                      setWeeklyMeta(null)
                      setWeeklyData(null)
                      setWeeklyError(res.message ?? res.error)
                      setWeeklyLoading(false)
                      return
                    }
                    setWeeklyMeta(res.meta)
                    setWeeklyData(res.data)
                    setWeeklyLoading(false)
                  })
                  .catch((e) => {
                    const name =
                      typeof e === 'object' && e && 'name' in e
                        ? String((e as { name: unknown }).name)
                        : ''
                    if (name === 'AbortError') return
                    setWeeklyMeta(null)
                    setWeeklyData(null)
                    setWeeklyError('网络异常或 API 不可用')
                    setWeeklyLoading(false)
                  })
              }}
            />
          </div>

          {weeklyData ? (
            <div className="mt-4">
              <EtfWeeklyChart series={weeklyData.series} />
            </div>
          ) : null}
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-3">
          {['资金流', '更多指标'].map((t) => (
            <div
              key={t}
              className="rounded-xl border border-white/10 bg-[#111B2E] p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{t}</div>
                <Construction className="h-4 w-4 text-[#A9B6CC]" />
              </div>
              <div className="mt-2 text-xs text-[#A9B6CC]">模块占位，后续上线</div>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}

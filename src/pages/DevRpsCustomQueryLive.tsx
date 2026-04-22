import RpsStylePanel from '@/components/RpsStylePanel'

export default function DevRpsCustomQueryLive() {
  return (
    <main className="min-h-screen bg-[#050A0B] px-4 py-6 text-[#E6EDF7] sm:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-4">
        <section className="overflow-hidden rounded-lg border border-[#1E293B] bg-[#0F172A] p-4 shadow-lg">
          <div className="text-xl font-semibold tracking-tight text-white">RPS 自定义查询 Live 验收页</div>
          <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-[#94A3B8]">
            <p>该页面仅在本地开发环境开放，绕开登录壳，但直接复用真实的 `RpsStylePanel` 与 `/api/rps/custom-query`。</p>
            <p>用于验证非预置 ETF 在页面摘要区与图表说明位置是否能直接展示中文名称及代码。</p>
          </div>
        </section>

        <RpsStylePanel page="custom-query" />
      </div>
    </main>
  )
}

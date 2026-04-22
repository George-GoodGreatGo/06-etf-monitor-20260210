import PageBreadcrumb from '@/components/PageBreadcrumb'
import RpsStylePanel from '@/components/RpsStylePanel'

export default function MarketRpsOverview() {
  return (
    <div className="space-y-4">
      <PageBreadcrumb
        items={[
          { label: '市场风格RPS', to: '/market/rps' },
          { label: '总览' },
        ]}
      />
      <RpsStylePanel page="overview" />
    </div>
  )
}

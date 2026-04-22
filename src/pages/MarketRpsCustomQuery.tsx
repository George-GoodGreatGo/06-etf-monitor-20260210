import PageBreadcrumb from '@/components/PageBreadcrumb'
import RpsStylePanel from '@/components/RpsStylePanel'

export default function MarketRpsCustomQuery() {
  return (
    <div className="space-y-4">
      <PageBreadcrumb
        items={[
          { label: '市场风格RPS', to: '/market/rps' },
          { label: '自定义查询' },
        ]}
      />
      <RpsStylePanel page="custom-query" />
    </div>
  )
}

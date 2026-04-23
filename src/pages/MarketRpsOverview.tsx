import PageBreadcrumb from '@/components/PageBreadcrumb'
import PageContentContainer from '@/components/PageContentContainer'
import RpsStylePanel from '@/components/RpsStylePanel'

export default function MarketRpsOverview() {
  return (
    <PageContentContainer>
      <PageBreadcrumb
        items={[
          { label: '市场风格RPS', to: '/market/rps' },
          { label: '总览' },
        ]}
      />
      <RpsStylePanel page="overview" />
    </PageContentContainer>
  )
}

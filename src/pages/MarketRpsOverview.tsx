import PageBreadcrumb from '@/components/PageBreadcrumb'
import PageContentContainer from '@/components/PageContentContainer'
import RpsStylePanel from '@/components/RpsStylePanel'
import CnMarketStylePanel from '@/components/CnMarketStylePanel'

export default function MarketRpsOverview() {
  return (
    <PageContentContainer>
      <PageBreadcrumb
        items={[
          { label: '市场风格RPS', to: '/market/rps' },
          { label: '总览' },
        ]}
      />
      <CnMarketStylePanel>
        <RpsStylePanel page="turnover" />
      </CnMarketStylePanel>
    </PageContentContainer>
  )
}

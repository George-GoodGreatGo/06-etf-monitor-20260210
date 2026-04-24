import PageBreadcrumb from '@/components/PageBreadcrumb'
import PageContentContainer from '@/components/PageContentContainer'
import RpsStylePanel from '@/components/RpsStylePanel'

export default function MarketRpsCustomQuery() {
  return (
    <PageContentContainer>
      <PageBreadcrumb
        items={[
          { label: '市场风格RPS', to: '/market/rps' },
          { label: '动量分析' },
        ]}
      />
      <RpsStylePanel page="custom-query" />
    </PageContentContainer>
  )
}

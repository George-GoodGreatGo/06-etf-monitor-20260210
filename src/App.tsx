import { Suspense, lazy, type ReactNode } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import RequireAuth from '@/components/RequireAuth'
import AppShell from '@/components/AppShell'
import BackToTopButton from '@/components/BackToTopButton'

const Home = lazy(() => import('@/pages/Home'))
const QuotesHome = lazy(() => import('@/pages/QuotesHome'))
const EtfDetail = lazy(() => import('@/pages/EtfDetail'))
const Methodology = lazy(() => import('@/pages/Methodology'))
const Login = lazy(() => import('@/pages/Login'))
const MarketRpsOverview = lazy(() => import('@/pages/MarketRpsOverview'))
const MarketRpsCustomQuery = lazy(() => import('@/pages/MarketRpsCustomQuery'))
const MarketRpsMethodology = lazy(() => import('@/pages/MarketRpsMethodology'))
const DevRpsCustomQueryLive = lazy(() => import('@/pages/DevRpsCustomQueryLive'))
const DevRpsCustomQueryMock = lazy(() => import('@/pages/DevRpsCustomQueryMock'))
const DevTop200MomentumSignalsMock = lazy(() => import('@/pages/DevTop200MomentumSignalsMock'))

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-10 text-sm text-[#A9B6CC]">
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
        <span>页面加载中...</span>
      </div>
    </div>
  )
}

function withRouteSuspense(page: ReactNode) {
  return <Suspense fallback={<RouteLoadingFallback />}>{page}</Suspense>
}

export default function App() {
  return (
    <div className="min-h-screen bg-[#050A0B] text-[#E6EDF7]">
      <BackToTopButton />
      <Router>
        <Routes>
          <Route path="/login" element={withRouteSuspense(<Login />)} />
          {import.meta.env.DEV ? (
            <Route path="/dev/rps-custom-query-mock" element={withRouteSuspense(<DevRpsCustomQueryMock />)} />
          ) : null}
          {import.meta.env.DEV ? (
            <Route path="/dev/rps-custom-query-live" element={withRouteSuspense(<DevRpsCustomQueryLive />)} />
          ) : null}
          {import.meta.env.DEV ? (
            <Route path="/dev/top200-momentum-signals-mock" element={withRouteSuspense(<DevTop200MomentumSignalsMock />)} />
          ) : null}
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={withRouteSuspense(<QuotesHome />)} />
            <Route path="/market" element={withRouteSuspense(<Home />)} />
            <Route path="/market/rps" element={withRouteSuspense(<MarketRpsOverview />)} />
            <Route path="/market/rps/custom-query" element={withRouteSuspense(<MarketRpsCustomQuery />)} />
            <Route path="/market/rps/methodology" element={withRouteSuspense(<MarketRpsMethodology />)} />
            <Route path="/etf/:code" element={withRouteSuspense(<EtfDetail />)} />
            <Route path="/methodology" element={withRouteSuspense(<Methodology />)} />
          </Route>
        </Routes>
      </Router>
    </div>
  )
}

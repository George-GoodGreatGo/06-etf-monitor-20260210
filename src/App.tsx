import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import QuotesHome from '@/pages/QuotesHome'
import EtfDetail from '@/pages/EtfDetail'
import Methodology from '@/pages/Methodology'
import Login from '@/pages/Login'
import MarketRpsOverview from '@/pages/MarketRpsOverview'
import MarketRpsCustomQuery from '@/pages/MarketRpsCustomQuery'
import DevRpsCustomQueryMock from '@/pages/DevRpsCustomQueryMock'
import RequireAuth from '@/components/RequireAuth'
import AppShell from '@/components/AppShell'
import BackToTopButton from '@/components/BackToTopButton'

export default function App() {
  return (
    <div className="min-h-screen bg-[#050A0B] text-[#E6EDF7]">
      <BackToTopButton />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          {import.meta.env.DEV ? <Route path="/dev/rps-custom-query-mock" element={<DevRpsCustomQueryMock />} /> : null}
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<QuotesHome />} />
            <Route path="/market" element={<Home />} />
            <Route path="/market/rps" element={<MarketRpsOverview />} />
            <Route path="/market/rps/custom-query" element={<MarketRpsCustomQuery />} />
            <Route path="/etf/:code" element={<EtfDetail />} />
            <Route path="/methodology" element={<Methodology />} />
          </Route>
        </Routes>
      </Router>
    </div>
  )
}

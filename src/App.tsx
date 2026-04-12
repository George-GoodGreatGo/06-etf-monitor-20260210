import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import EtfDetail from '@/pages/EtfDetail'
import Methodology from '@/pages/Methodology'
import Login from '@/pages/Login'
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
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/etf/:code" element={<EtfDetail />} />
            <Route path="/methodology" element={<Methodology />} />
          </Route>
        </Routes>
      </Router>
    </div>
  )
}

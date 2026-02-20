import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import EtfDetail from '@/pages/EtfDetail'
import Methodology from '@/pages/Methodology'
import Login from '@/pages/Login'
import RequireAuth from '@/components/RequireAuth'

export default function App() {
  return (
    <div className="min-h-screen bg-[#0B1220] text-[#E6EDF7]">
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />
          <Route
            path="/etf/:code"
            element={
              <RequireAuth>
                <EtfDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/methodology"
            element={
              <RequireAuth>
                <Methodology />
              </RequireAuth>
            }
          />
        </Routes>
      </Router>
    </div>
  )
}

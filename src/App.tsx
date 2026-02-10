import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from '@/pages/Home'
import EtfDetail from '@/pages/EtfDetail'
import Methodology from '@/pages/Methodology'

export default function App() {
  return (
    <div className="min-h-screen bg-[#0B1220] text-[#E6EDF7]">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/etf/:code" element={<EtfDetail />} />
          <Route path="/methodology" element={<Methodology />} />
        </Routes>
      </Router>
    </div>
  )
}

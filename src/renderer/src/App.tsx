import { HashRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Dashboard } from './pages/Dashboard'
import { Charts } from './pages/Charts'
import { HistoryPage } from './pages/History'
import { SettingsPage } from './pages/Settings'
import { useSpeedData } from './hooks/useSpeedData'

function Layout(): JSX.Element {
  useSpeedData()

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden print:block print:h-auto print:overflow-visible">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 print:block">
        <Header />
        <main className="flex-1 overflow-auto p-6 print:overflow-visible print:h-auto print:flex-none">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/charts" element={<Charts />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App(): JSX.Element {
  return (
    <HashRouter>
      <Layout />
    </HashRouter>
  )
}

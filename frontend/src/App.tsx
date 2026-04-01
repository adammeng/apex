import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import AppLayout from './components/AppLayout'
import DashboardPage from './pages/dashboard'
import MatrixPage from './pages/matrix'
import PipelinePage from './pages/pipeline'
import CompetitionPage from './pages/competition'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 分钟缓存
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN}>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/matrix" element={<MatrixPage />} />
              <Route path="/pipeline" element={<PipelinePage />} />
              <Route path="/competition" element={<CompetitionPage />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

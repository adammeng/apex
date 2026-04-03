import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import AppLayout from './components/AppLayout'
import RequireAuth from './components/RequireAuth'
import MatrixPage from './pages/matrix'
import PipelinePage from './pages/pipeline'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#1a73e8',
            colorInfo: '#1a73e8',
            colorSuccess: '#1e8e3e',
            colorText: '#1f2937',
            colorTextSecondary: '#5f6b7a',
            colorBorder: '#dde3ea',
            colorBgContainer: '#ffffff',
            colorFillSecondary: '#f6f8fb',
            borderRadius: 12,
            borderRadiusLG: 16,
            boxShadowSecondary: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.06)',
            fontFamily: "'Google Sans', 'Roboto', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Microsoft YaHei', sans-serif"
          },
          components: {
            Button: {
              controlHeight: 36,
              borderRadius: 12,
              fontWeight: 500
            },
            Select: {
              controlHeight: 40,
              borderRadius: 12
            },
            TreeSelect: {
              controlHeight: 40
            },
            Switch: {
              handleBg: '#ffffff',
              colorPrimary: '#1a73e8'
            },
            Menu: {
              darkItemBg: 'transparent',
              darkSubMenuItemBg: 'transparent',
              darkItemSelectedBg: '#111b3a',
              darkItemHoverBg: 'rgba(255, 255, 255, 0.03)',
              darkItemColor: '#a8b3c7',
              darkItemSelectedColor: '#ffffff',
              itemBorderRadius: 0,
              itemHeight: 44,
              itemMarginInline: 0,
              itemMarginBlock: 0
            }
          }
        }}
      >
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <RequireAuth>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/matrix" replace />} />
                <Route path="/matrix" element={<MatrixPage />} />
                <Route path="/pipeline" element={<PipelinePage />} />
                <Route path="*" element={<Navigate to="/matrix" replace />} />
              </Routes>
            </AppLayout>
          </RequireAuth>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

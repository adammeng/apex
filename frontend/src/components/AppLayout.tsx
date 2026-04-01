import { Layout, Menu, Typography } from 'antd'
import {
  DashboardOutlined,
  TableOutlined,
  ApartmentOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

const { Header, Sider, Content } = Layout
const { Title } = Typography

interface AppLayoutProps {
  children: ReactNode
}

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '数据总览' },
  { key: '/matrix', icon: <TableOutlined />, label: '竞争矩阵' },
  { key: '/pipeline', icon: <ApartmentOutlined />, label: '研发泳道' },
  { key: '/competition', icon: <BarChartOutlined />, label: '竞争格局' },
]

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            Apex
          </Title>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>药物研发情报平台</div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div style={{ flex: 1 }} />
          <div style={{ color: '#666', fontSize: 13 }}>港药内部分析平台</div>
        </Header>
        <Content style={{ margin: 24, minHeight: 280 }}>{children}</Content>
      </Layout>
    </Layout>
  )
}

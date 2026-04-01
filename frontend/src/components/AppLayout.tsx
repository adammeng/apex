import { Layout, Menu, Typography, Avatar, Dropdown, Button } from 'antd'
import {
  DashboardOutlined,
  TableOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '../stores/auth'

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
  const { user, logout } = useAuthStore()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

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
          {user ? (
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                }}
              >
                <Avatar
                  size={28}
                  src={user.avatar_url || undefined}
                  icon={!user.avatar_url && <UserOutlined />}
                  style={{ background: '#1677ff' }}
                />
                <span style={{ color: '#333', fontSize: 13 }}>{user.name}</span>
              </div>
            </Dropdown>
          ) : (
            <Button type="link" size="small" onClick={handleLogout}>
              退出
            </Button>
          )}
        </Header>
        <Content style={{ margin: 24, minHeight: 280 }}>{children}</Content>
      </Layout>
    </Layout>
  )
}

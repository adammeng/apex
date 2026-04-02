import { Layout, Menu, Typography, Avatar, Button, Tag } from 'antd'
import {
  TableOutlined,
  ApartmentOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { systemApi } from '../services/system'
import { useAuthStore } from '../stores/auth'
import { formatDateTime } from '../utils/datetime'

const { Header, Sider, Content } = Layout
const { Title } = Typography

interface AppLayoutProps {
  children: ReactNode
}

const menuItems = [
  { key: '/matrix', icon: <TableOutlined />, label: '竞争矩阵' },
  { key: '/pipeline', icon: <ApartmentOutlined />, label: '研发泳道' },
]

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const { data: syncStatus } = useQuery({
    queryKey: ['system-sync-status'],
    queryFn: systemApi.getSyncStatus,
  })
  const syncedAt = formatDateTime(
    syncStatus?.latest_version?.synced_at ?? syncStatus?.latest_sync_job?.updated_at ?? null
  )

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        width={220}
        collapsedWidth={72}
        collapsible
        collapsed={collapsed}
        trigger={null}
        theme="dark"
        style={{ overflow: 'auto' }}
      >
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            {collapsed ? 'A' : 'Apex'}
          </Title>
          {!collapsed ? (
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>药物研发情报平台</div>
          ) : null}
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
      <Layout style={{ minWidth: 0 }}>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            borderBottom: '1px solid #f0f0f0',
            flex: '0 0 auto',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? '展开菜单' : '折叠菜单'}
          />
          <div style={{ flex: 1 }} />
          {syncedAt ? <Tag color="blue">系统同步至 {syncedAt}</Tag> : null}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar
                size={28}
                src={user.avatar_url || undefined}
                icon={!user.avatar_url && <UserOutlined />}
                style={{ background: '#1677ff' }}
              />
              <span style={{ color: '#333', fontSize: 13 }}>{user.name}</span>
            </div>
          )}
        </Header>
        <Content
          style={{
            margin: 24,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

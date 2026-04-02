import { Layout, Menu, Avatar } from 'antd'
import {
  AppstoreOutlined,
  RiseOutlined,
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
import './AppLayout.css'

const { Header, Sider, Content } = Layout

interface AppLayoutProps {
  children: ReactNode
}

const menuItems = [
  { key: '/matrix', icon: <AppstoreOutlined />, label: '靶点组合竞争格局' },
  { key: '/pipeline', icon: <RiseOutlined />, label: '靶点研发进展格局' },
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

  const currentPage = menuItems.find((item) => item.key === location.pathname)

  return (
    <Layout className="app-shell" style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        className="app-shell__sider"
        width={240}
        collapsedWidth={64}
        collapsible
        collapsed={collapsed}
        trigger={null}
        theme="dark"
        style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div className={`app-sider__brand ${collapsed ? 'is-collapsed' : ''}`}>
          {collapsed ? (
            <div className="app-sider__brand-mark">
              A
            </div>
          ) : (
            <div className="app-sider__brand-text">
              <div className="app-sider__brand-title">Apex</div>
              <div className="app-sider__brand-subtitle">药物研发情报平台</div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="app-sider__caption">
            MAIN NAVIGATION
          </div>
        )}

        <div className="app-sider__menu-wrap">
          <Menu
            className="app-sider__menu"
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: 'transparent', border: 'none', marginTop: collapsed ? 8 : 0 }}
          />
        </div>

        {user && (
          <div className={`app-sider__user ${collapsed ? 'is-collapsed' : ''}`}>
            <Avatar
              size={32}
              src={user.avatar_url || undefined}
              icon={!user.avatar_url && <UserOutlined />}
              className="app-sider__user-avatar"
            />
            {!collapsed && (
              <div className="app-sider__user-meta">
                <div className="app-sider__user-name">{user.name}</div>
                <div className="app-sider__user-email">{user.email ?? ''}</div>
              </div>
            )}
          </div>
        )}
      </Sider>

      <Layout className="app-shell__main" style={{ minWidth: 0 }}>
        <Header
          className="app-header"
          style={{ height: 64, lineHeight: '64px', flex: '0 0 auto' }}
        >
          <button
            className="app-header__icon-btn"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? '展开菜单' : '折叠菜单'}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>

          <nav className="app-header__crumbs">
            <span className="app-header__crumb" onClick={() => navigate('/matrix')}>
              首页
            </span>
            {currentPage && (
              <>
                <span className="app-header__crumb-sep">/</span>
                <span className="app-header__crumb app-header__crumb--current">{currentPage.label}</span>
              </>
            )}
          </nav>

          {syncedAt && (
            <div className="app-header__sync">
              <span className="app-header__sync-dot" />
              系统同步至 {syncedAt}
            </div>
          )}

        </Header>

        <Content
          className="app-shell__content"
          style={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          <div className="app-shell__content-inner">
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

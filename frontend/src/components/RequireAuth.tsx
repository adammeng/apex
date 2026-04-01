import { Spin } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../stores/auth'
import { silentLogin, mockSilentLogin, fetchMe } from '../services/auth'
import type { ReactNode } from 'react'

const isDev = import.meta.env.DEV

interface RequireAuthProps {
  children: ReactNode
}

/**
 * 认证守卫 — 全程静默，无任何登录 UI。
 *
 * 生产（飞书客户端内）：
 *   1. 有 token → 直接渲染
 *   2. 无 token → 调飞书 JS SDK getAuthCode → POST /auth/feishu/code2token → 存 JWT → 渲染
 *
 * 开发（本地浏览器）：
 *   1. 有 token → 直接渲染
 *   2. 无 token → POST /auth/mock-login → 存 JWT → 渲染
 *   （模拟生产静默流程，后端 DEBUG=true 时可用）
 */
export default function RequireAuth({ children }: RequireAuthProps) {
  const { token, user, setToken, setUser, logout } = useAuthStore()
  const [ready, setReady] = useState(!!token)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function init() {
      // 已有 token：补全 user 信息后直接进入
      if (token) {
        if (!user) {
          try {
            const me = await fetchMe()
            setUser(me)
          } catch {
            // token 过期或无效，重新走静默登录
            logout()
            await doSilentLogin()
          }
        }
        setReady(true)
        return
      }

      await doSilentLogin()
    }

    async function doSilentLogin() {
      try {
        const accessToken = isDev ? await mockSilentLogin() : await silentLogin()
        setToken(accessToken)
        const me = await fetchMe()
        setUser(me)
        setReady(true)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
      }
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 14,
        }}
      >
        登录失败，请重新打开应用
      </div>
    )
  }

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  return <>{children}</>
}

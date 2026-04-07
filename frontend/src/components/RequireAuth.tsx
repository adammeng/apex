import { Spin } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../stores/auth'
import {
  silentLogin,
  mockSilentLogin,
  fetchMe,
  isFeishuContainer,
  getAuthDebugSummary,
  getAuthRuntimeSnapshot,
} from '../services/auth'
import type { ReactNode } from 'react'

interface RequireAuthProps {
  children: ReactNode
}

function shouldUseMockLogin() {
  // 只判断是否在飞书客户端内，不在飞书里（含 PC 浏览器、其他环境）均走 mock 开发用户
  return !isFeishuContainer()
}

/**
 * 认证守卫 — 全程静默，无任何登录 UI。
 *
 * 飞书客户端内：
 *   1. 有 token → 直接渲染
 *   2. 无 token → 调飞书 JS SDK requestAuthCode → POST /auth/feishu/code2token → 存 JWT → 渲染
 *
 * 非飞书环境（PC 浏览器、开发本地等）：
 *   1. 有 token → 直接渲染
 *   2. 无 token → POST /auth/mock-login → 存 JWT → 渲染
 *   （后端 DEBUG=true 时可用；生产如需限制，可在后端关闭 mock-login 接口）
 */
export default function RequireAuth({ children }: RequireAuthProps) {
  const { token, user, setToken, setUser, logout } = useAuthStore()
  const [ready, setReady] = useState(!!token)
  const [error, setError] = useState<string | null>(null)
  const [diagnostics, setDiagnostics] = useState('')
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
            // 如果当前已处于飞书环境，但本地还残留 mock token，强制重新走真实静默登录。
            if (isFeishuContainer() && me.open_id === 'mock_open_id_dev') {
              logout()
              await doSilentLogin()
              return
            }
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
        const accessToken = shouldUseMockLogin()
          ? await mockSilentLogin()
          : await silentLogin()
        setToken(accessToken)
        const me = await fetchMe()
        setUser(me)
        setReady(true)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const snapshot = JSON.stringify(getAuthRuntimeSnapshot(), null, 2)
        const debug = getAuthDebugSummary()
        const detail = [snapshot, debug].filter(Boolean).join('\n\n')
        console.error('[apex-auth] login failed', { msg, detail })
        setError(msg)
        setDiagnostics(detail)
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
          flexDirection: 'column',
          gap: 12,
          padding: 24,
        }}
      >
        <div
          style={{
            border: '1px solid #ffccc7',
            background: '#fff2f0',
            color: '#cf1322',
            borderRadius: 12,
            padding: '16px 20px',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          授权失败
        </div>
        <div
          style={{
            maxWidth: 720,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#8c8c8c',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          {error}
        </div>
        {diagnostics ? (
          <pre
            style={{
              maxWidth: 960,
              width: '100%',
              overflowX: 'auto',
              margin: 0,
              padding: 16,
              borderRadius: 12,
              border: '1px solid #f0f0f0',
              background: '#fafafa',
              color: '#595959',
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {diagnostics}
          </pre>
        ) : null}
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

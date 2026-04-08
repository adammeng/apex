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
 *   1. 有 token → fetchMe 校验有效性 → 有效则渲染
 *   2. token 失效 → 清除 → 重走 silentLogin（JS SDK 重新获取 code → 换 JWT）
 *   3. 无 token → 直接 silentLogin
 *
 * 非飞书环境（PC 浏览器）：
 *   1. 有 token → fetchMe 校验有效性 → 有效则渲染
 *   2. token 失效（fetchMe 抛 401）→ request.ts 的 401 拦截器清除 token 并 reload，
 *      FeishuGuard 检测到无 token 展示引导页，用户重新网页授权
 *   3. 无 token → mock-login（DEV）或 FeishuGuard 拦截展示引导页（生产）
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

    async function init() {
      if (token) {
        try {
          const me = await fetchMe()
          // mock token 在任何生产环境（飞书内或外部浏览器）都必须驱逐
          const isMockToken = me.open_id === 'mock_open_id_dev'
          if (isMockToken && !import.meta.env.DEV) {
            logout()
            await doSilentLogin()
            return
          }
          setUser(me)
          setReady(true)
        } catch {
          // token 过期或无效
          logout()
          if (isFeishuContainer()) {
            // 飞书内：JS SDK 重新获取 code，静默换 JWT，用户无感知
            await doSilentLogin()
          } else {
            // 外部浏览器：request.ts 的 401 拦截器已触发 reload
            // 若是非 401 的网络错误，给一个友好提示
            setError('登录已过期，请重新授权')
          }
        }
        return
      }

      await doSilentLogin()
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

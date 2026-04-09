/**
 * FeishuGuard — 外部浏览器访问引导与 OAuth 回调处理
 *
 * 场景一：飞书客户端内
 *   → 直接透传，由 RequireAuth 走 JS SDK 静默登录
 *
 * 场景二：外部浏览器，URL 中带 access_token（OAuth 回调落地）
 *   → 存入 localStorage，清理 URL query，透传给子组件
 *
 * 场景三：外部浏览器，URL 中带 auth_error（OAuth 失败回调）
 *   → 展示错误提示 + 重试按钮
 *
 * 场景四：外部浏览器，无 token 无 error
 *   → 显示「请在飞书中打开」引导页，提供 applink 跳转 + 网页授权两种入口
 *
 * DEV 模式下跳过所有检测，直接透传。
 */

import { useEffect, useState, type ReactNode } from 'react'
import { isFeishuContainer } from '../services/auth'
import { useAuthStore } from '../stores/auth'

const FEISHU_APP_ID = import.meta.env.VITE_FEISHU_APP_ID as string
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '/api'

/** 飞书 applink：点击后在飞书客户端内打开网页应用 */
function buildAppLink() {
  return `https://applink.feishu.cn/client/web_app/open?appId=${FEISHU_APP_ID}`
}

/** 后端发起飞书网页 OAuth 授权的入口 URL */
function buildOAuthRedirectUrl() {
  // 生产环境 API_BASE 可能是绝对路径（如 https://api.example.com/api）
  // 开发环境是 /api，此时拼上 origin
  const base = /^https?:\/\//.test(API_BASE)
    ? API_BASE
    : `${window.location.origin}${API_BASE}`
  return `${base}/auth/feishu/redirect`
}

/** 从 URL query 里取出 token 并清理，返回 token 或 null */
function consumeTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('access_token')
  if (!token) return null
  // 清理 URL，避免 token 暴露在浏览器历史记录
  params.delete('access_token')
  const newSearch = params.toString()
  const newUrl = newSearch
    ? `${window.location.pathname}?${newSearch}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`
  window.history.replaceState(null, '', newUrl)
  return token
}

/** 从 URL query 里取出 auth_error 并清理 */
function consumeAuthErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const err = params.get('auth_error')
  if (!err) return null
  params.delete('auth_error')
  const newSearch = params.toString()
  const newUrl = newSearch
    ? `${window.location.pathname}?${newSearch}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`
  window.history.replaceState(null, '', newUrl)
  return err
}

type GuardState =
  | { type: 'loading' }
  | { type: 'pass' }            // 直接透传给子组件
  | { type: 'guide' }           // 显示引导页
  | { type: 'error'; reason: string } // OAuth 失败

interface FeishuGuardProps {
  children: ReactNode
}

export default function FeishuGuard({ children }: FeishuGuardProps) {
  const [state, setState] = useState<GuardState>({ type: 'loading' })
  const setToken = useAuthStore((state) => state.setToken)

  useEffect(() => {
    // 开发模式直接透传
    if (import.meta.env.DEV) {
      setState({ type: 'pass' })
      return
    }

    // 飞书客户端内直接透传，由 RequireAuth 走 JS SDK 静默登录
    if (isFeishuContainer()) {
      setState({ type: 'pass' })
      return
    }

    // 检查 OAuth 失败回调（auth_error query 参数）
    const authError = consumeAuthErrorFromUrl()
    if (authError) {
      setState({ type: 'error', reason: authError })
      return
    }

    // 检查 OAuth 成功回调（URL 携带 access_token）
    const token = consumeTokenFromUrl()
    if (token) {
      setToken(token)
      setState({ type: 'pass' })
      return
    }

    // 已有 token（之前登录过）直接透传，RequireAuth 会校验有效性
    // 生产环境如果是 mock token，提前清掉，走引导页重新授权
    const stored = localStorage.getItem('access_token')
    if (stored) {
      if (!import.meta.env.DEV) {
        try {
          const payload = JSON.parse(atob(stored.split('.')[1]))
          if (payload?.open_id === 'mock_open_id_dev') {
            localStorage.removeItem('access_token')
            setState({ type: 'guide' })
            return
          }
        } catch {
          // token 格式异常，清掉走引导页
          localStorage.removeItem('access_token')
          setState({ type: 'guide' })
          return
        }
      }
      setToken(stored)
      setState({ type: 'pass' })
      return
    }

    // 外部浏览器，无 token → 显示引导页
    setState({ type: 'guide' })
  }, [setToken])

  if (state.type === 'loading') {
    return null
  }

  if (state.type === 'pass') {
    return <>{children}</>
  }

  return (
    <GuideLayout
      error={state.type === 'error' ? state.reason : undefined}
    />
  )
}

// ---------------------------------------------------------------------------
// 引导页 UI
// ---------------------------------------------------------------------------

function GuideLayout({ error }: { error?: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f6f8fb',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '48px 40px',
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 1px 2px rgba(15,23,42,0.06), 0 8px 24px rgba(15,23,42,0.06)',
          maxWidth: 420,
          width: '90%',
        }}
      >
        {/* 图标 */}
        <div style={{ marginBottom: 24 }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="56" height="56" rx="16" fill="#1a73e8" fillOpacity="0.08" />
            <path
              d="M28 14C20.268 14 14 20.268 14 28C14 35.732 20.268 42 28 42C35.732 42 42 35.732 42 28C42 20.268 35.732 14 28 14ZM28 38C22.477 38 18 33.523 18 28C18 22.477 22.477 18 28 18C33.523 18 38 22.477 38 28C38 33.523 33.523 38 28 38Z"
              fill="#1a73e8"
            />
            <path
              d="M28 22V28L32 32"
              stroke="#1a73e8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {error ? (
          <>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#cf1322',
                marginBottom: 12,
              }}
            >
              授权失败
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#5f6b7a',
                marginBottom: 32,
                lineHeight: 1.6,
              }}
            >
              飞书授权过程中出现错误（{error}），请重试。
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#1f2937',
                marginBottom: 12,
                lineHeight: 1.4,
              }}
            >
              请完成飞书身份验证
            </div>
            <div
              style={{
                fontSize: 14,
                color: '#5f6b7a',
                marginBottom: 32,
                lineHeight: 1.6,
              }}
            >
              Apex 是港药内部工具，需要飞书账号验证身份。
              <br />
              如已安装飞书客户端，可直接跳转打开；
              <br />
              也可在当前浏览器中完成网页授权。
            </div>
          </>
        )}

        {/* 主按钮：applink 跳转飞书客户端 */}
        <a
          href={buildAppLink()}
          style={{
            display: 'block',
            padding: '10px 0',
            background: '#1a73e8',
            color: '#ffffff',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 500,
            textDecoration: 'none',
            marginBottom: 12,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLAnchorElement).style.background = '#1557b0'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLAnchorElement).style.background = '#1a73e8'
          }}
        >
          在飞书客户端中打开
        </a>

        {/* 次按钮：浏览器内 OAuth 网页授权 */}
        <a
          href={buildOAuthRedirectUrl()}
          style={{
            display: 'block',
            padding: '10px 0',
            background: 'transparent',
            color: '#1a73e8',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
            border: '1px solid #d0e3ff',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLAnchorElement).style.background = '#f0f6ff'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
          }}
        >
          在当前浏览器中授权
        </a>
      </div>
    </div>
  )
}

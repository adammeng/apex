/**
 * FeishuGuard — 外部浏览器访问时显示「请在飞书中打开」引导页
 *
 * 检测规则：
 * - UA 含 Lark / Feishu → 飞书客户端，直接透传
 * - window.h5sdk 存在 → 飞书客户端，直接透传
 * - 其余情况 → 外部浏览器，显示引导页
 *
 * 仅处理桌面端场景（移动端行为与桌面一致，applink 同样有效）
 */

import type { ReactNode } from 'react'
import { isFeishuContainer } from '../services/auth'

const FEISHU_APP_ID = import.meta.env.VITE_FEISHU_APP_ID as string

/** 拉起飞书客户端并打开指定网页应用的 applink */
function buildAppLink() {
  return `https://applink.feishu.cn/client/web_app/open?appId=${FEISHU_APP_ID}`
}

interface FeishuGuardProps {
  children: ReactNode
}

export default function FeishuGuard({ children }: FeishuGuardProps) {
  // 开发模式下跳过检测，继续走 mock 登录
  if (import.meta.env.DEV) {
    return <>{children}</>
  }

  if (isFeishuContainer()) {
    return <>{children}</>
  }

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
          maxWidth: 400,
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

        {/* 标题 */}
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#1f2937',
            marginBottom: 12,
            lineHeight: 1.4,
          }}
        >
          请在飞书中打开
        </div>

        {/* 说明文字 */}
        <div
          style={{
            fontSize: 14,
            color: '#5f6b7a',
            marginBottom: 32,
            lineHeight: 1.6,
          }}
        >
          Apex 是港药内部工具，需要通过飞书客户端访问以完成身份验证。
        </div>

        {/* 跳转按钮 */}
        <a
          href={buildAppLink()}
          style={{
            display: 'inline-block',
            padding: '10px 32px',
            background: '#1a73e8',
            color: '#ffffff',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLAnchorElement).style.background = '#1557b0'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLAnchorElement).style.background = '#1a73e8'
          }}
        >
          在飞书中打开
        </a>
      </div>
    </div>
  )
}

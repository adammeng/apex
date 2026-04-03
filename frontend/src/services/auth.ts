import request from './request'
import type { UserInfo } from '../stores/auth'

export type { UserInfo }
const FEISHU_SDK_URL = 'https://lf1-cdn-tos.bytegoofy.com/goofy/lark/op/h5-js-sdk-1.5.43.js'

/**
 * 飞书 JS SDK 类型声明（H5 内嵌应用环境）
 * 实际由飞书客户端注入 window.h5sdk
 */
declare global {
  interface Window {
    __apexFeishuSdkLoading?: Promise<void>
    h5sdk?: {
      ready: (cb: () => void) => void
      getAuthCode: (params: {
        appId: string
        success: (res: { code: string }) => void
        fail: (err: unknown) => void
      }) => void
    }
  }
}

export function isFeishuContainer() {
  if (typeof window === 'undefined') {
    return false
  }

  if (window.h5sdk) {
    return true
  }

  const ua = window.navigator.userAgent
  return /Lark|Feishu/i.test(ua)
}

async function ensureFeishuSdk() {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持飞书 SDK')
  }

  if (window.h5sdk) {
    return
  }

  if (!isFeishuContainer()) {
    throw new Error('非飞书客户端环境')
  }

  if (!window.__apexFeishuSdkLoading) {
    window.__apexFeishuSdkLoading = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[data-sdk="feishu-h5"][src="${FEISHU_SDK_URL}"]`
      )

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true })
        existingScript.addEventListener('error', () => reject(new Error('飞书 SDK 加载失败')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = FEISHU_SDK_URL
      script.async = true
      script.dataset.sdk = 'feishu-h5'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('飞书 SDK 加载失败'))
      document.head.appendChild(script)
    })
  }

  await window.__apexFeishuSdkLoading
}

/**
 * 静默登录：在飞书客户端内通过 JS SDK 获取授权码，换取 JWT。
 * 全程无 UI，用户完全无感知。
 */
export async function silentLogin(): Promise<string> {
  await ensureFeishuSdk()

  return new Promise((resolve, reject) => {
    const appId = import.meta.env.VITE_FEISHU_APP_ID

    const sdk = window.h5sdk
    if (!sdk) {
      reject(new Error('非飞书客户端环境，h5sdk 不存在'))
      return
    }

    sdk.ready(() => {
      sdk.getAuthCode({
        appId,
        success: async ({ code }) => {
          try {
            const res = await request.post<{ data: { access_token: string } }>(
              '/auth/feishu/code2token',
              { code }
            )
            resolve(res.data.data.access_token)
          } catch (err) {
            reject(err)
          }
        },
        fail: (err) => reject(err),
      })
    })
  })
}

/**
 * Mock 静默登录（仅开发环境）
 * 调用后端 mock-login 接口，返回真实 JWT，模拟生产流程。
 */
export async function mockSilentLogin(): Promise<string> {
  const res = await request.post<{ data: { access_token: string } }>('/auth/mock-login')
  return res.data.data.access_token
}

/** 获取当前登录用户信息（需要有效 JWT） */
export async function fetchMe(): Promise<UserInfo> {
  const res = await request.get<{ data: UserInfo }>('/auth/me')
  return res.data.data
}

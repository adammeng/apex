import request from './request'
import type { UserInfo } from '../stores/auth'

export type { UserInfo }

function stringifySdkError(err: unknown) {
  if (err instanceof Error) {
    return err.message
  }

  if (typeof err === 'string') {
    return err
  }

  if (err && typeof err === 'object') {
    try {
      return JSON.stringify(err)
    } catch {
      return '[object]'
    }
  }

  return String(err)
}

/**
 * 飞书 JS SDK 类型声明（H5 内嵌应用环境）
 * 参考 s_employee_front，统一使用静态注入的 H5 SDK。
 */
declare global {
  interface Window {
    h5sdk?: Record<string, unknown>
    tt?: {
      requestAccess?: (params: {
        appID: string
        scopeList?: string[]
        success: (res: { code: string }) => void
        fail: (err: unknown) => void
      }) => void
      requestAuthCode: (params: {
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

  if (!isFeishuContainer()) {
    throw new Error('非飞书客户端环境')
  }

  if (window.h5sdk && window.tt) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    let attempts = 0
    const maxAttempts = 60

    const timer = window.setInterval(() => {
      if (window.h5sdk && window.tt) {
        window.clearInterval(timer)
        resolve()
        return
      }

      attempts += 1
      if (attempts >= maxAttempts) {
        window.clearInterval(timer)
        reject(new Error('飞书 SDK 加载超时'))
      }
    }, 100)
  })
}

/**
 * 静默登录：在飞书客户端内通过 JS SDK 获取授权码，换取 JWT。
 * 全程无 UI，用户完全无感知。
 */
export async function silentLogin(): Promise<string> {
  await ensureFeishuSdk()

  return new Promise((resolve, reject) => {
    const appId = import.meta.env.VITE_FEISHU_APP_ID
    const requestAccessApi = window.tt?.requestAccess
    const requestAuthCodeApi = window.tt?.requestAuthCode

    if (!requestAccessApi && !requestAuthCodeApi) {
      reject(new Error('飞书客户端环境异常，授权接口不存在'))
      return
    }

    const exchangeCode = async (code: string) => {
      try {
        const res = await request.post<{ data: { access_token: string } }>(
          '/auth/feishu/code2token',
          { code }
        )
        resolve(res.data.data.access_token)
      } catch (err) {
        reject(err)
      }
    }

    if (requestAccessApi) {
      requestAccessApi({
        appID: appId,
        scopeList: [],
        success: ({ code }) => void exchangeCode(code),
        fail: (err) => reject(new Error(`飞书授权失败: ${stringifySdkError(err)}`)),
      })
      return
    }

    requestAuthCodeApi?.({
      appId,
      success: ({ code }) => void exchangeCode(code),
      fail: (err) => reject(new Error(`飞书授权失败: ${stringifySdkError(err)}`)),
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

import request from './request'
import type { UserInfo } from '../stores/auth'

export type { UserInfo }

function maskCode(code: string) {
  if (!code) {
    return ''
  }

  if (code.length <= 10) {
    return code
  }

  return `${code.slice(0, 6)}...${code.slice(-4)}`
}

function recordAuthDebug(step: string, detail?: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return
  }

  const entry = {
    time: new Date().toISOString(),
    step,
    detail: detail ?? {},
  }

  const bucket = ((window as Window & { __APEX_AUTH_DEBUG__?: unknown[] }).__APEX_AUTH_DEBUG__ ??= [])
  bucket.push(entry)
  console.info('[apex-auth]', step, detail ?? {})
}

export function getAuthDebugSummary() {
  if (typeof window === 'undefined') {
    return ''
  }

  const entries = (window as Window & { __APEX_AUTH_DEBUG__?: Array<{ time: string; step: string; detail?: Record<string, unknown> }> }).__APEX_AUTH_DEBUG__ ?? []

  if (!entries.length) {
    return ''
  }

  return entries
    .map((entry) => `${entry.time} ${entry.step} ${JSON.stringify(entry.detail ?? {})}`)
    .join('\n')
}

export function getAuthRuntimeSnapshot() {
  if (typeof window === 'undefined') {
    return {}
  }

  return {
    href: window.location.href,
    origin: window.location.origin,
    userAgent: window.navigator.userAgent,
    hasH5sdk: !!window.h5sdk,
    hasTt: !!window.tt,
    hasRequestAccess: !!window.tt?.requestAccess,
    hasRequestAuthCode: !!window.tt?.requestAuthCode,
    appId: import.meta.env.VITE_FEISHU_APP_ID || '',
  }
}

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
  recordAuthDebug('sdk.ensure.start', getAuthRuntimeSnapshot())

  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持飞书 SDK')
  }

  if (!isFeishuContainer()) {
    throw new Error('非飞书客户端环境')
  }

  if (window.h5sdk && window.tt) {
    recordAuthDebug('sdk.ensure.ready', getAuthRuntimeSnapshot())
    return
  }

  await new Promise<void>((resolve, reject) => {
    let attempts = 0
    const maxAttempts = 60

    const timer = window.setInterval(() => {
      if (window.h5sdk && window.tt) {
        window.clearInterval(timer)
        recordAuthDebug('sdk.ensure.loaded', getAuthRuntimeSnapshot())
        resolve()
        return
      }

      attempts += 1
      if (attempts >= maxAttempts) {
        window.clearInterval(timer)
        recordAuthDebug('sdk.ensure.timeout', {
          attempts,
          ...getAuthRuntimeSnapshot(),
        })
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

    recordAuthDebug('silentLogin.start', {
      appId,
      hasRequestAccess: !!requestAccessApi,
      hasRequestAuthCode: !!requestAuthCodeApi,
    })

    if (!requestAccessApi && !requestAuthCodeApi) {
      reject(new Error('飞书客户端环境异常，授权接口不存在'))
      return
    }

    const exchangeCode = async (code: string) => {
      try {
        recordAuthDebug('silentLogin.code.received', {
          code: maskCode(code),
        })
        const res = await request.post<{ data: { access_token: string } }>(
          '/auth/feishu/code2token',
          { code }
        )
        recordAuthDebug('silentLogin.code.exchanged', {
          accessToken: 'received',
        })
        resolve(res.data.data.access_token)
      } catch (err) {
        recordAuthDebug('silentLogin.code.exchange.failed', {
          error: stringifySdkError(err),
        })
        reject(err)
      }
    }

    if (requestAccessApi) {
      recordAuthDebug('silentLogin.requestAccess.invoke', {
        appID: appId,
      })
      requestAccessApi({
        appID: appId,
        scopeList: [],
        success: ({ code }) => void exchangeCode(code),
        fail: (err) => {
          recordAuthDebug('silentLogin.requestAccess.failed', {
            error: stringifySdkError(err),
          })
          reject(new Error(`飞书授权失败: ${stringifySdkError(err)}`))
        },
      })
      return
    }

    recordAuthDebug('silentLogin.requestAuthCode.invoke', {
      appId,
    })
    requestAuthCodeApi?.({
      appId,
      success: ({ code }) => void exchangeCode(code),
      fail: (err) => {
        recordAuthDebug('silentLogin.requestAuthCode.failed', {
          error: stringifySdkError(err),
        })
        reject(new Error(`飞书授权失败: ${stringifySdkError(err)}`))
      },
    })
  })
}

/**
 * Mock 静默登录（仅开发环境）
 * 调用后端 mock-login 接口，返回真实 JWT，模拟生产流程。
 */
export async function mockSilentLogin(): Promise<string> {
  recordAuthDebug('mockLogin.start')
  const res = await request.post<{ data: { access_token: string } }>('/auth/mock-login')
  return res.data.data.access_token
}

/** 获取当前登录用户信息（需要有效 JWT） */
export async function fetchMe(): Promise<UserInfo> {
  const res = await request.get<{ data: UserInfo }>('/auth/me')
  return res.data.data
}

import request from './request'
import type { UserInfo } from '../stores/auth'

export type { UserInfo }

/**
 * 飞书 JS SDK 类型声明（H5 内嵌应用环境）
 * 实际由飞书客户端注入 window.h5sdk
 */
declare global {
  interface Window {
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

/**
 * 静默登录：在飞书客户端内通过 JS SDK 获取授权码，换取 JWT。
 * 全程无 UI，用户完全无感知。
 */
export function silentLogin(): Promise<string> {
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

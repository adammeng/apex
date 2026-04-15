import axios from 'axios'
import { isFeishuContainer } from './auth'

/**
 * JWT 失效时的重新授权策略：
 * - 飞书客户端：仅清除 token，不 reload。
 *   RequireAuth 的 catch 块会捕获 fetchMe() 的 401 错误，主动调用 doSilentLogin()。
 *   若此处也 reload，会与 doSilentLogin() 竞争并打断正在进行的 JS SDK 静默授权流程。
 * - 外部浏览器：清除 token，重载页面，由 FeishuGuard 显示引导页重新授权。
 *
 * 使用 reload 而非路由跳转的原因（外部浏览器）：
 * 1. 认证组件（FeishuGuard / RequireAuth）在组件挂载时初始化，重新走 useEffect
 * 2. 避免跳到不存在的 /login 路由导致循环重定向
 */
function handleUnauthorized() {
  localStorage.removeItem('access_token')
  // 避免重复触发（如并发请求同时 401）
  if (window.location.href.includes('auth_error')) return
  // 飞书客户端内：只清 token，不 reload。
  // RequireAuth 会在 fetchMe() 失败后自行走 silentLogin()，reload 会打断该流程。
  if (isFeishuContainer()) return
  window.location.reload()
}

// 并发 401 防抖：只触发一次重授权，避免多请求同时 401 导致多次 reload
let _unauthorizedHandled = false
function handleUnauthorizedOnce() {
  if (_unauthorizedHandled) return
  _unauthorizedHandled = true
  // 给其余 promise 链一个 tick 完成 reject，再执行重授权
  setTimeout(() => {
    _unauthorizedHandled = false
    handleUnauthorized()
  }, 50)
}

function resolveApiBaseUrl() {
  if (import.meta.env.DEV) {
    // 开发模式统一走同源 /api，由 Vite 代理转发，避免 localhost/IP 混用引发跨域。
    return '/api'
  }

  const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!rawBaseUrl) {
    return '/api'
  }

  if (!/^https?:\/\//i.test(rawBaseUrl)) {
    return rawBaseUrl
  }

  const normalized = rawBaseUrl.replace(/\/+$/, '')
  if (normalized.endsWith('/api')) {
    return normalized
  }

  return `${normalized}/api`
}

const request = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

function resolveHttpErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === 'string' && detail.trim()) {
      return detail
    }

    const msg = error.response?.data?.msg
    if (typeof msg === 'string' && msg.trim()) {
      return msg
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return '请求失败'
}

// 请求拦截器：自动附加 JWT
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：统一处理业务错误
request.interceptors.response.use(
  (response) => {
    const data = response.data
    if (data.code !== 0) {
      return Promise.reject(new Error(data.msg || '请求失败'))
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      handleUnauthorizedOnce()
    }
    return Promise.reject(new Error(resolveHttpErrorMessage(error)))
  }
)

export default request

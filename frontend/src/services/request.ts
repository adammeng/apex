import axios from 'axios'

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
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(new Error(resolveHttpErrorMessage(error)))
  }
)

export default request

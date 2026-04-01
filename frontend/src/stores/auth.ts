import { create } from 'zustand'

export interface UserInfo {
  open_id: string
  name: string
  avatar_url: string
  email: string
}

interface AuthState {
  token: string | null
  user: UserInfo | null
  setToken: (token: string) => void
  setUser: (user: UserInfo | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('access_token'),
  user: null,

  setToken: (token) => {
    localStorage.setItem('access_token', token)
    set({ token })
  },

  setUser: (user) => set({ user }),

  logout: () => {
    localStorage.removeItem('access_token')
    set({ token: null, user: null })
  },
}))

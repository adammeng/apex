import { create } from 'zustand'

interface AuthState {
  token: string | null
  user: { open_id: string; name: string } | null
  setToken: (token: string) => void
  setUser: (user: AuthState['user']) => void
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

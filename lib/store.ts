import { create } from 'zustand'
import { AuthUser, saveToken, clearAuth, getToken, getUser } from './auth'

interface AuthState {
  token:       string | null
  user:        AuthUser | null
  initialized: boolean
  setAuth:     (token: string, user: AuthUser) => Promise<void>
  logout:      () => Promise<void>
  init:        () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  token:       null,
  user:        null,
  initialized: false,

  setAuth: async (token, user) => {
    await saveToken(token, user)
    set({ token, user })
  },

  logout: async () => {
    await clearAuth()
    set({ token: null, user: null })
  },

  init: async () => {
    const token = await getToken()
    const user  = await getUser()
    set({ token, user, initialized: true })
  },
}))

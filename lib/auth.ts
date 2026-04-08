import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'financy_token'
const USER_KEY  = 'financy_user'

export interface AuthUser {
  id:    string
  email: string
  name?: string | null
}

export async function saveToken(token: string, user: AuthUser) {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user))
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function getUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export async function clearAuth() {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
  await SecureStore.deleteItemAsync(USER_KEY)
}

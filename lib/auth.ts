import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY     = 'finexa_token'
const USER_KEY      = 'finexa_user'
const TOKEN_KEY_OLD = 'financy_token'
const USER_KEY_OLD  = 'financy_user'

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
  let token = await SecureStore.getItemAsync(TOKEN_KEY)
  if (!token) {
    // Migration depuis l'ancienne clé
    token = await SecureStore.getItemAsync(TOKEN_KEY_OLD)
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token)
      await SecureStore.deleteItemAsync(TOKEN_KEY_OLD)
    }
  }
  return token
}

export async function getUser(): Promise<AuthUser | null> {
  let raw = await SecureStore.getItemAsync(USER_KEY)
  if (!raw) {
    // Migration depuis l'ancienne clé
    raw = await SecureStore.getItemAsync(USER_KEY_OLD)
    if (raw) {
      await SecureStore.setItemAsync(USER_KEY, raw)
      await SecureStore.deleteItemAsync(USER_KEY_OLD)
    }
  }
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export async function clearAuth() {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
  await SecureStore.deleteItemAsync(USER_KEY)
  await SecureStore.deleteItemAsync(TOKEN_KEY_OLD)
  await SecureStore.deleteItemAsync(USER_KEY_OLD)
}

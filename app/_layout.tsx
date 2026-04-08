import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from '@/lib/store'
import { colors } from '@/constants/theme'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function AuthGuard() {
  const { token, initialized } = useAuthStore()
  const segments = useSegments()
  const router   = useRouter()

  useEffect(() => {
    if (!initialized) return
    const inTabs  = segments[0] === '(tabs)'
    const inLogin = segments[0] === 'login'

    if (token && !inTabs) {
      router.replace('/(tabs)')
    } else if (!token && !inLogin) {
      router.replace('/login')
    }
  }, [initialized, token])

  return null
}

export default function RootLayout() {
  const { init } = useAuthStore()

  useEffect(() => { init() }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" backgroundColor={colors.background} />
        <AuthGuard />
        <Stack
          screenOptions={{
            headerShown:  false,
            contentStyle: { backgroundColor: colors.background },
            animation:    'fade',
          }}
        >
          <Stack.Screen name="login"             />
          <Stack.Screen name="register"          />
          <Stack.Screen name="forgot-password"   />
          <Stack.Screen name="reset-password"    />
          <Stack.Screen name="(tabs)"            />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}

import { useEffect } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from '@/lib/store'
import { colors, fontSize, radius } from '@/constants/theme'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function SplashScreen() {
  return (
    <View style={splash.container}>
      <View style={splash.logoWrap}>
        <View style={splash.logoIcon}>
          <Text style={splash.logoLetter}>F</Text>
        </View>
        <Text style={splash.logoText}>Finexa</Text>
        <Text style={splash.logoSub}>Gestion de patrimoine</Text>
      </View>
      <ActivityIndicator color={colors.accent} size="small" style={{ marginTop: 48 }} />
    </View>
  )
}

const splash = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  logoWrap:   { alignItems: 'center', gap: 12 },
  logoIcon: {
    width: 80, height: 80, borderRadius: 22,
    backgroundColor: colors.accent + '15',
    borderWidth: 1, borderColor: colors.accent + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  logoLetter: { color: colors.accent, fontSize: 36, fontWeight: '800' },
  logoText:   { color: colors.textPrimary, fontSize: fontSize['3xl'], fontWeight: '700', letterSpacing: -0.5 },
  logoSub:    { color: colors.textMuted, fontSize: fontSize.sm },
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
  const { init, initialized } = useAuthStore()

  useEffect(() => { init() }, [])

  if (!initialized) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" backgroundColor={colors.background} />
        <SplashScreen />
      </GestureHandlerRootView>
    )
  }

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

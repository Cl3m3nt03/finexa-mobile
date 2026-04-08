import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { useAuthStore } from '@/lib/store'
import { API_BASE } from '@/constants/api'

export default function LoginScreen() {
  const { setAuth } = useAuthStore()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPwd,  setShowPwd]  = useState(false)

  async function handleLogin() {
    if (!email.trim() || !password) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/mobile`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        Alert.alert('Erreur', data.error ?? 'Identifiants invalides.')
        return
      }
      await setAuth(data.token, data.user)
      router.replace('/(tabs)')
    } catch {
      Alert.alert('Erreur', 'Impossible de se connecter au serveur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <View style={s.logo}>
        <View style={s.logoIcon}>
          <Text style={s.logoLetter}>F</Text>
        </View>
        <Text style={s.logoText}>Financy</Text>
        <Text style={s.logoSub}>Gestion de patrimoine</Text>
      </View>

      {/* ── Formulaire ────────────────────────────────────────────────── */}
      <View style={s.form}>
        <View style={s.fieldGroup}>
          <Text style={s.label}>Email</Text>
          <View style={s.inputWrap}>
            <Ionicons name="mail-outline" size={16} color={colors.textMuted} style={s.inputIcon} />
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={s.fieldGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={s.label}>Mot de passe</Text>
            <TouchableOpacity onPress={() => router.push('/forgot-password')}>
              <Text style={s.forgotLink}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          </View>
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} style={s.inputIcon} />
            <TextInput
              style={[s.input, { paddingRight: 44 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPwd}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPwd(v => !v)}>
              <Ionicons name={showPwd ? 'eye-outline' : 'eye-off-outline'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[s.btn, loading && { opacity: 0.6 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color={colors.background} />
            : <Text style={s.btnText}>Se connecter</Text>
          }
        </TouchableOpacity>

        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>ou</Text>
          <View style={s.dividerLine} />
        </View>

        <TouchableOpacity onPress={() => router.push('/register')} activeOpacity={0.7} style={s.registerBtn}>
          <Text style={s.registerText}>
            Pas encore de compte ?{'  '}
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Créer un compte</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background,
    justifyContent: 'center', paddingHorizontal: spacing.xl,
  },

  logo: { alignItems: 'center', marginBottom: spacing['2xl'] },
  logoIcon: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: colors.accent + '15',
    borderWidth: 1, borderColor: colors.accent + '30',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  logoLetter: { color: colors.accent, fontSize: 28, fontWeight: '800' },
  logoText:   { color: colors.textPrimary, fontSize: fontSize['3xl'], fontWeight: '700', letterSpacing: -0.5 },
  logoSub:    { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4 },

  form: { gap: 16 },

  fieldGroup: { gap: 6 },
  label: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '500' },

  inputWrap: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: colors.surface,
    borderWidth:     1,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 14,
    color:     colors.textPrimary,
    fontSize:  fontSize.md,
  },
  eyeBtn: { padding: 8 },

  forgotLink: { color: colors.accent, fontSize: fontSize.xs },

  btn: {
    backgroundColor: colors.accent,
    borderRadius:    radius.md,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       4,
  },
  btnText: { color: colors.background, fontSize: fontSize.md, fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: fontSize.xs },

  registerBtn:  { paddingVertical: 4 },
  registerText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
})

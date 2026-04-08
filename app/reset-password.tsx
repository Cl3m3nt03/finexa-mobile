import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { API_BASE } from '@/constants/api'

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPwd,   setShowPwd]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [success,   setSuccess]   = useState(false)
  const [error,     setError]     = useState('')

  const rules = [
    { label: 'Au moins 8 caractères',          ok: password.length >= 8 },
    { label: 'Une majuscule',                   ok: /[A-Z]/.test(password) },
    { label: 'Un chiffre',                      ok: /[0-9]/.test(password) },
    { label: 'Les mots de passe correspondent', ok: password === confirm && confirm.length > 0 },
  ]
  const allOk = rules.every(r => r.ok)

  async function handleSubmit() {
    if (!allOk || !token) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur.'); return }
      setSuccess(true)
      setTimeout(() => router.replace('/login'), 2500)
    } catch {
      setError('Impossible de joindre le serveur.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>❌</Text>
        <Text style={s.title}>Lien invalide</Text>
        <Text style={[s.subtitle, { textAlign: 'center', marginBottom: 20 }]}>
          Ce lien est invalide ou a expiré.
        </Text>
        <TouchableOpacity style={s.btn} onPress={() => router.replace('/forgot-password')}>
          <Text style={s.btnText}>Demander un nouveau lien</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (success) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
        <Text style={s.title}>Mot de passe mis à jour !</Text>
        <Text style={[s.subtitle, { textAlign: 'center' }]}>Redirection en cours...</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.logo}>
          <View style={s.logoIcon}>
            <Text style={s.logoSymbol}>F</Text>
          </View>
          <Text style={s.title}>Nouveau mot de passe</Text>
          <Text style={s.subtitle}>Choisissez un mot de passe sécurisé</Text>
        </View>

        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.label}>Nouveau mot de passe</Text>
            <TouchableOpacity onPress={() => setShowPwd(v => !v)}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                {showPwd ? 'Masquer' : 'Afficher'}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={s.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPwd}
          />

          <Text style={[s.label, { marginTop: 4 }]}>Confirmer</Text>
          <TextInput
            style={s.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPwd}
          />

          {/* Rules */}
          {password.length > 0 && (
            <View style={{ gap: 4 }}>
              {rules.map(r => (
                <Text key={r.label} style={{ color: r.ok ? colors.success : colors.textMuted, fontSize: fontSize.xs }}>
                  {r.ok ? '✓ ' : '○ '}{r.label}
                </Text>
              ))}
            </View>
          )}

          {error ? <Text style={{ color: colors.danger, fontSize: fontSize.xs }}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.btn, (!allOk || loading) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!allOk || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={colors.background} />
              : <Text style={s.btnText}>Changer le mot de passe</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: {
    flexGrow: 1, backgroundColor: colors.background,
    justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xl,
  },
  logo: { alignItems: 'center', marginBottom: spacing.xl },
  logoIcon: {
    width: 56, height: 56, borderRadius: radius.xl,
    backgroundColor: colors.accent + '20', borderWidth: 1, borderColor: colors.accent + '40',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  logoSymbol: { color: colors.accent, fontSize: 28, fontWeight: '700' },
  title:    { color: colors.textPrimary, fontSize: fontSize['2xl'], fontWeight: '700' },
  subtitle: { color: colors.textMuted,  fontSize: fontSize.sm, marginTop: 6 },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.lg, gap: 10,
  },
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '500' },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14,
    color: colors.textPrimary, fontSize: fontSize.md,
  },
  btn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  btnText: { color: colors.background, fontSize: fontSize.md, fontWeight: '700' },
})

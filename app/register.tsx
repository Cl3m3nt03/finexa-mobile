import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { API_BASE } from '@/constants/api'
import { useAuthStore } from '@/lib/store'

type Step = 'form' | 'otp'

export default function RegisterScreen() {
  const { setAuth } = useAuthStore()

  const [step,     setStep]     = useState<Step>('form')
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [otp,      setOtp]      = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const rules = [
    { label: 'Au moins 8 caractères', ok: password.length >= 8 },
    { label: 'Une majuscule',          ok: /[A-Z]/.test(password) },
    { label: 'Un chiffre',             ok: /[0-9]/.test(password) },
    { label: 'Mots de passe identiques', ok: password === confirm && confirm.length > 0 },
  ]
  const formOk = name.trim().length > 0 && /\S+@\S+/.test(email) && rules.every(r => r.ok)

  async function handleRegister() {
    if (!formOk) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`${API_BASE}/api/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur.'); return }
      setStep('otp')
    } catch {
      setError('Impossible de joindre le serveur.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`${API_BASE}/api/auth/register/verify-2fa`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), code: otp }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Code invalide.'); return }

      // Compte vérifié → connexion automatique
      const loginRes  = await fetch(`${API_BASE}/api/auth/mobile`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      const loginData = await loginRes.json()
      if (!loginRes.ok) {
        router.replace('/login')
        return
      }
      await setAuth(loginData.token, loginData.user)
      router.replace('/(tabs)')
    } catch {
      setError('Impossible de joindre le serveur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Logo */}
        <View style={s.logo}>
          <View style={s.logoIcon}>
            <Text style={s.logoSymbol}>F</Text>
          </View>
          <Text style={s.title}>{step === 'otp' ? 'Vérification email' : 'Créer un compte'}</Text>
          <Text style={s.subtitle}>
            {step === 'otp'
              ? `Code envoyé à ${email}`
              : 'Rejoignez Financy gratuitement'}
          </Text>
        </View>

        <View style={s.card}>
          {step === 'form' ? (
            <>
              <Text style={s.label}>Prénom &amp; Nom</Text>
              <TextInput
                style={s.input} value={name} onChangeText={setName}
                placeholder="Jean Dupont" placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />

              <Text style={[s.label, { marginTop: 4 }]}>Email</Text>
              <TextInput
                style={s.input} value={email} onChangeText={setEmail}
                placeholder="votre@email.com" placeholderTextColor={colors.textMuted}
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={s.label}>Mot de passe</Text>
                <TouchableOpacity onPress={() => setShowPwd(v => !v)}>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                    {showPwd ? 'Masquer' : 'Afficher'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={s.input} value={password} onChangeText={setPassword}
                placeholder="••••••••" placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPwd}
              />

              <Text style={[s.label, { marginTop: 4 }]}>Confirmer</Text>
              <TextInput
                style={s.input} value={confirm} onChangeText={setConfirm}
                placeholder="••••••••" placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPwd}
              />

              {/* Password rules */}
              {password.length > 0 && (
                <View style={{ gap: 3 }}>
                  {rules.map(r => (
                    <Text key={r.label} style={{ color: r.ok ? colors.success : colors.textMuted, fontSize: fontSize.xs }}>
                      {r.ok ? '✓ ' : '○ '}{r.label}
                    </Text>
                  ))}
                </View>
              )}

              {error ? <Text style={s.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[s.btn, (!formOk || loading) && { opacity: 0.5 }]}
                onPress={handleRegister} disabled={!formOk || loading} activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={colors.background} />
                  : <Text style={s.btnText}>Créer mon compte</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.otpHint}>
                Entrez le code à 6 chiffres reçu par email pour valider votre compte.
              </Text>

              <TextInput
                style={[s.input, s.otpInput]}
                value={otp} onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000" placeholderTextColor={colors.textMuted}
                keyboardType="number-pad" maxLength={6}
                autoFocus
              />

              {error ? <Text style={s.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[s.btn, (otp.length !== 6 || loading) && { opacity: 0.5 }]}
                onPress={handleVerifyOtp} disabled={otp.length !== 6 || loading} activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={colors.background} />
                  : <Text style={s.btnText}>Vérifier et se connecter</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setStep('form'); setOtp(''); setError('') }} style={s.backBtn}>
                <Text style={s.backText}>← Modifier mes informations</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={s.divider} />

          <TouchableOpacity onPress={() => router.replace('/login')} style={s.backBtn}>
            <Text style={s.backText}>Déjà un compte ? Se connecter</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  scroll: {
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
  title:      { color: colors.textPrimary, fontSize: fontSize['2xl'], fontWeight: '700' },
  subtitle:   { color: colors.textMuted,   fontSize: fontSize.sm, marginTop: 6, textAlign: 'center' },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.lg, gap: 10,
  },
  label: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '500' },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14,
    color: colors.textPrimary, fontSize: fontSize.md,
  },
  otpInput: { textAlign: 'center', fontSize: 28, fontWeight: '700', letterSpacing: 12, color: colors.accent },
  otpHint:  { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  error:  { color: colors.danger, fontSize: fontSize.xs },
  btn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  btnText:  { color: colors.background, fontSize: fontSize.md, fontWeight: '700' },
  divider:  { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  backBtn:  { alignItems: 'center', paddingVertical: 4 },
  backText: { color: colors.textMuted, fontSize: fontSize.sm },
})

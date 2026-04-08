import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch } from '@/lib/api'

interface Alert_ {
  id:        string
  assetId:   string | null
  symbol:    string | null
  name:      string | null
  type:      'ABOVE' | 'BELOW' | 'CHANGE_PCT'
  threshold: number
  active:    boolean
}

// ── Section: Changement de mot de passe ──────────────────────────────────────

function PasswordSection() {
  const [form, setForm]       = useState({ current: '', next: '', confirm: '' })
  const [show, setShow]       = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError('')
    if (form.next !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (form.next.length < 8)        { setError('Le mot de passe doit faire au moins 8 caractères.'); return }
    setLoading(true)
    try {
      await apiFetch('/api/auth/password', {
        method: 'POST',
        body:   JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      })
      setSuccess(true)
      setForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors du changement.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={s.card}>
      <View style={s.cardTitleRow}>
        <View style={[s.sectionIcon, { backgroundColor: colors.accent + '15' }]}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.accent} />
        </View>
        <Text style={s.cardTitle}>Mot de passe</Text>
      </View>

      <View style={{ gap: 10, marginTop: 14 }}>
        <View>
          <Text style={s.label}>Mot de passe actuel</Text>
          <View style={s.inputRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={form.current}
              onChangeText={v => setForm(f => ({ ...f, current: v }))}
              secureTextEntry={!show}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity onPress={() => setShow(v => !v)} style={{ padding: 10 }}>
              <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
        <View>
          <Text style={s.label}>Nouveau mot de passe</Text>
          <TextInput
            style={s.input}
            value={form.next}
            onChangeText={v => setForm(f => ({ ...f, next: v }))}
            secureTextEntry={!show}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View>
          <Text style={s.label}>Confirmer le nouveau mot de passe</Text>
          <TextInput
            style={s.input}
            value={form.confirm}
            onChangeText={v => setForm(f => ({ ...f, confirm: v }))}
            secureTextEntry={!show}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {error !== '' && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
            <Text style={{ color: colors.danger, fontSize: fontSize.xs, flex: 1 }}>{error}</Text>
          </View>
        )}
        {success && (
          <View style={s.successBox}>
            <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: fontSize.xs }}>Mot de passe mis à jour !</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.primaryBtn, (loading || !form.current || !form.next || !form.confirm) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={loading || !form.current || !form.next || !form.confirm}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color={colors.background} size="small" />
            : <Text style={s.primaryBtnText}>Modifier le mot de passe</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Section: Double authentification ─────────────────────────────────────────

function TwoFASection() {
  const [step, setStep]       = useState<'idle' | 'setup' | 'disable'>('idle')
  const [enabled, setEnabled] = useState(false)
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  async function handleSetup() {
    setLoading(true); setError('')
    try {
      await apiFetch('/api/auth/2fa/setup', { method: 'POST' })
      setStep('setup')
    } catch { setError('Erreur lors de l\'envoi. Réessayez.') }
    finally   { setLoading(false) }
  }

  async function handleVerify() {
    if (!code || code.length !== 6) { setError('Code à 6 chiffres requis.'); return }
    setLoading(true); setError('')
    try {
      await apiFetch('/api/auth/2fa/verify', {
        method: 'POST',
        body:   JSON.stringify({ code }),
      })
      setEnabled(true); setStep('idle'); setCode('')
      setSuccess('2FA activée avec succès !')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) { setError(e?.message ?? 'Code invalide.') }
    finally { setLoading(false) }
  }

  async function handleDisable() {
    if (!code || code.length !== 6) { setError('Code à 6 chiffres requis.'); return }
    setLoading(true); setError('')
    try {
      await apiFetch('/api/auth/2fa/disable', {
        method: 'POST',
        body:   JSON.stringify({ code }),
      })
      setEnabled(false); setStep('idle'); setCode('')
      setSuccess('2FA désactivée.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e: any) { setError(e?.message ?? 'Code invalide.') }
    finally { setLoading(false) }
  }

  return (
    <View style={s.card}>
      <View style={s.cardTitleRow}>
        <View style={[s.sectionIcon, { backgroundColor: colors.success + '15' }]}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
        </View>
        <Text style={s.cardTitle}>Double authentification (2FA)</Text>
      </View>

      <View style={{ gap: 12, marginTop: 14 }}>
        <View style={s.toggleRow}>
          <View>
            <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' }}>
              Authentification par e-mail
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
              {enabled ? 'Activée — votre compte est sécurisé' : 'Désactivée'}
            </Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: enabled ? colors.success + '18' : colors.surface2 }]}>
            <Text style={{ color: enabled ? colors.success : colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' }}>
              {enabled ? 'ON' : 'OFF'}
            </Text>
          </View>
        </View>

        {step === 'idle' && (
          <TouchableOpacity
            style={[s.secondaryBtn, { borderColor: enabled ? colors.danger + '50' : colors.accent + '50' }]}
            onPress={enabled ? () => setStep('disable') : handleSetup}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading
              ? <ActivityIndicator color={colors.accent} size="small" />
              : <Text style={{ color: enabled ? colors.danger : colors.accent, fontSize: fontSize.sm, fontWeight: '600' }}>
                  {enabled ? 'Désactiver la 2FA' : 'Activer la 2FA'}
                </Text>
            }
          </TouchableOpacity>
        )}

        {(step === 'setup' || step === 'disable') && (
          <>
            <View style={s.infoBox}>
              <Ionicons name="mail-outline" size={14} color={colors.accent} />
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, flex: 1 }}>
                {step === 'setup'
                  ? 'Un code à 6 chiffres a été envoyé à votre adresse e-mail.'
                  : 'Entrez le code 2FA pour confirmer la désactivation.'
                }
              </Text>
            </View>
            <TextInput
              style={[s.input, { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: '700' }]}
              value={code}
              onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              maxLength={6}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => { setStep('idle'); setCode(''); setError('') }} activeOpacity={0.7}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.sm }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, { flex: 1 }, (loading || code.length !== 6) && { opacity: 0.5 }]}
                onPress={step === 'setup' ? handleVerify : handleDisable}
                disabled={loading || code.length !== 6}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={colors.background} size="small" />
                  : <Text style={s.primaryBtnText}>{step === 'setup' ? 'Vérifier' : 'Confirmer'}</Text>
                }
              </TouchableOpacity>
            </View>
          </>
        )}

        {error !== '' && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
            <Text style={{ color: colors.danger, fontSize: fontSize.xs, flex: 1 }}>{error}</Text>
          </View>
        )}
        {success !== '' && (
          <View style={s.successBox}>
            <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: fontSize.xs }}>{success}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ── Section: Alertes de prix ──────────────────────────────────────────────────

function AlertsSection() {
  const queryClient = useQueryClient()

  const { data: alerts = [], isLoading } = useQuery<Alert_[]>({
    queryKey: ['alerts'],
    queryFn:  () => apiFetch('/api/alerts'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/alerts/${id}`, { method: 'DELETE' }),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  function confirmDelete(id: string, name: string) {
    Alert.alert('Supprimer', `Supprimer l'alerte pour "${name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ])
  }

  const TYPE_LABEL: Record<string, string> = {
    ABOVE:      '↑ Au-dessus de',
    BELOW:      '↓ En-dessous de',
    CHANGE_PCT: '% Variation de',
  }

  return (
    <View style={s.card}>
      <View style={s.cardTitleRow}>
        <View style={[s.sectionIcon, { backgroundColor: colors.warning + '15' }]}>
          <Ionicons name="notifications-outline" size={16} color={colors.warning} />
        </View>
        <Text style={s.cardTitle}>Alertes de prix</Text>
      </View>

      {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />}

      {alerts.length === 0 && !isLoading && (
        <View style={{ alignItems: 'center', paddingVertical: 24, marginTop: 8 }}>
          <Ionicons name="notifications-off-outline" size={32} color={colors.textMuted} style={{ marginBottom: 8 }} />
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' }}>
            Aucune alerte configurée.{'\n'}Créez-en depuis le site web pour les voir ici.
          </Text>
        </View>
      )}

      {alerts.length > 0 && (
        <View style={{ gap: 8, marginTop: 14 }}>
          {alerts.map(alert => (
            <View key={alert.id} style={s.alertRow}>
              <View style={[s.alertDot, { backgroundColor: alert.active ? colors.success : colors.textMuted }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' }}>
                  {alert.symbol ?? alert.name ?? 'Actif'}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>
                  {TYPE_LABEL[alert.type] ?? alert.type} {alert.threshold}
                  {alert.type === 'CHANGE_PCT' ? '%' : ' €'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => confirmDelete(alert.id, alert.symbol ?? alert.name ?? 'alerte')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.pageTitle}>Paramètres</Text>

        <PasswordSection />
        <TwoFASection />
        <AlertsSection />

        {/* ── Version info ─────────────────────────────────────────────── */}
        <View style={{ alignItems: 'center', paddingBottom: 8 }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Financy Mobile · v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  pageTitle: { color: colors.textPrimary, fontSize: fontSize['2xl'], fontWeight: '700', letterSpacing: -0.5, marginBottom: 4 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle:    { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  sectionIcon:  { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },

  label: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '500', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    color: colors.textPrimary, fontSize: fontSize.sm,
  },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.accent + '0A', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.accent + '20',
    paddingHorizontal: 10, paddingVertical: 8,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.danger + '10', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.danger + '30',
    paddingHorizontal: 10, paddingVertical: 8,
  },
  successBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.success + '10', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.success + '30',
    paddingHorizontal: 10, paddingVertical: 8,
  },

  primaryBtn:     { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: colors.background, fontWeight: '700', fontSize: fontSize.sm },
  secondaryBtn:   { borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  cancelBtn:      { flex: 1, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },

  toggleRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },

  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  alertDot: { width: 8, height: 8, borderRadius: 4 },
})

import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch, formatCurrency } from '@/lib/api'

interface Goal {
  id:          string
  name:        string
  targetValue: number
  currency:    string
  targetDate:  string | null
  notes:       string | null
}

interface DashboardStats { totalWealth: number }

const MILESTONES = [
  { label: '1k',   value: 1_000,    icon: '🌱' },
  { label: '5k',   value: 5_000,    icon: '💡' },
  { label: '10k',  value: 10_000,   icon: '⭐' },
  { label: '25k',  value: 25_000,   icon: '🔥' },
  { label: '50k',  value: 50_000,   icon: '💎' },
  { label: '100k', value: 100_000,  icon: '🏆' },
  { label: '250k', value: 250_000,  icon: '🦁' },
  { label: '500k', value: 500_000,  icon: '🚀' },
  { label: '1M',   value: 1_000_000, icon: '👑' },
]

function pmtMonthly(pv: number, fv: number, months: number, rate = 0.07 / 12) {
  if (months <= 0) return 0
  const rn = Math.pow(1 + rate, months)
  const pmt = rate > 0 ? (fv - pv * rn) * rate / (rn - 1) : (fv - pv) / months
  return Math.max(0, pmt)
}

export default function GoalsScreen() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', targetValue: '', targetDate: '', notes: '' })

  const { data: goals = [], isLoading, refetch, isRefetching } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn:  () => apiFetch('/api/goals'),
  })

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn:  () => apiFetch('/api/portfolio/stats'),
  })
  const totalValue = stats?.totalWealth ?? 0

  const createMutation = useMutation({
    mutationFn: (data: Partial<Goal>) => apiFetch('/api/goals', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      setShowForm(false)
      setForm({ name: '', targetValue: '', targetDate: '', notes: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/goals/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  })

  function confirmDelete(id: string, name: string) {
    Alert.alert('Supprimer', `Supprimer l'objectif "${name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ])
  }

  // Milestones — find next
  const nextMilestone = MILESTONES.find(m => m.value > totalValue)
  const prevMilestone = MILESTONES.filter(m => m.value <= totalValue).pop()

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.pageHeader}>
          <View>
            <Text style={s.pageTitle}>Objectifs</Text>
            <Text style={s.pageSub}>Jalons patrimoniaux</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(true)} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color={colors.background} />
          </TouchableOpacity>
        </View>

        {/* ── Milestones ─────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Paliers patrimoniaux</Text>
          {nextMilestone && (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={s.milestoneLabel}>
                  {prevMilestone?.icon ?? '🌱'} Actuel — {formatCurrency(totalValue)}
                </Text>
                <Text style={s.milestoneLabel}>
                  {nextMilestone.icon} {nextMilestone.label}
                </Text>
              </View>
              <View style={s.barBg}>
                <View style={[s.barFill, {
                  width: `${Math.min((totalValue / nextMilestone.value) * 100, 100)}%` as any,
                }]} />
              </View>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 6, textAlign: 'center' }}>
                Encore {formatCurrency(nextMilestone.value - totalValue)} pour atteindre {nextMilestone.icon} {nextMilestone.label}
              </Text>
            </View>
          )}
          <View style={s.milestonesRow}>
            {MILESTONES.map(m => {
              const reached = totalValue >= m.value
              return (
                <View key={m.label} style={[s.milestoneChip, reached && { backgroundColor: colors.accent + '18', borderColor: colors.accent + '40' }]}>
                  <Text style={{ fontSize: 14 }}>{m.icon}</Text>
                  <Text style={{ color: reached ? colors.accent : colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' }}>
                    {m.label}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* ── Objectifs personnels ────────────────────────────────────── */}
        {isLoading && <ActivityIndicator color={colors.accent} />}

        {goals.length === 0 && !isLoading && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 40 }]}>
            <View style={s.emptyIcon}>
              <Ionicons name="flag-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.md, fontWeight: '600', marginBottom: 4 }}>
              Aucun objectif défini
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' }}>
              Fixez-vous des jalons : 100k€, retraite anticipée, achat immobilier...
            </Text>
            <TouchableOpacity style={[s.addBtn, { marginTop: 16 }]} onPress={() => setShowForm(true)} activeOpacity={0.8}>
              <Ionicons name="add" size={18} color={colors.background} />
              <Text style={{ color: colors.background, fontSize: fontSize.sm, fontWeight: '700' }}>Créer un objectif</Text>
            </TouchableOpacity>
          </View>
        )}

        {goals.map(goal => {
          const progress  = Math.min((totalValue / goal.targetValue) * 100, 100)
          const remaining = goal.targetValue - totalValue
          const isReached = totalValue >= goal.targetValue
          const daysLeft  = goal.targetDate
            ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / 86400000)
            : null
          const months = daysLeft ? Math.max(1, Math.round(daysLeft / 30)) : null
          const pmt    = months ? pmtMonthly(totalValue, goal.targetValue, months) : null

          return (
            <View key={goal.id} style={[s.card, isReached && { borderColor: colors.success + '40' }]}>
              <View style={s.goalHeader}>
                <View style={[s.goalIcon, { backgroundColor: isReached ? colors.success + '18' : colors.accent + '18' }]}>
                  <Ionicons name="flag" size={16} color={isReached ? colors.success : colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.goalName}>{goal.name}</Text>
                  {daysLeft !== null && (
                    <Text style={{ color: daysLeft < 0 ? colors.danger : colors.textMuted, fontSize: fontSize.xs }}>
                      {daysLeft < 0 ? 'Expiré' : `${daysLeft}j restants`}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => confirmDelete(goal.id, goal.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Barre de progression */}
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{progress.toFixed(1)}% atteint</Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{formatCurrency(goal.targetValue, goal.currency)}</Text>
                </View>
                <View style={s.barBg}>
                  <View style={[s.barFill, {
                    width: `${progress}%` as any,
                    backgroundColor: isReached ? colors.success : colors.accent,
                  }]} />
                </View>
              </View>

              <View style={s.goalFooter}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Reste à atteindre</Text>
                <Text style={{ color: isReached ? colors.success : colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' }}>
                  {isReached ? '✓ Objectif atteint !' : formatCurrency(remaining, goal.currency)}
                </Text>
              </View>

              {/* Calculateur d'épargne */}
              {!isReached && pmt !== null && pmt > 0 && (
                <View style={s.pmtBox}>
                  <Ionicons name="sparkles" size={12} color={colors.accent} />
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, flex: 1 }}>
                    À 7%/an, épargnez{' '}
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>{formatCurrency(pmt)}/mois</Text>
                    {months ? ` pour atteindre cet objectif en ${months} mois.` : ''}
                  </Text>
                </View>
              )}

              {goal.notes && (
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                  {goal.notes}
                </Text>
              )}
            </View>
          )
        })}
      </ScrollView>

      {/* ── Modal création ─────────────────────────────────────────────── */}
      <Modal visible={showForm} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={s.modalOverlay} onPress={() => setShowForm(false)} activeOpacity={1}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={s.modalSheet}>
                <View style={s.modalHandle} />
                <Text style={s.modalTitle}>Nouvel objectif</Text>

                <Text style={s.label}>Nom</Text>
                <TextInput
                  style={s.input}
                  value={form.name}
                  onChangeText={v => setForm(f => ({ ...f, name: v }))}
                  placeholder="Retraite à 45 ans, 500k€..."
                  placeholderTextColor={colors.textMuted}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Montant cible (€)</Text>
                    <TextInput
                      style={s.input}
                      value={form.targetValue}
                      onChangeText={v => setForm(f => ({ ...f, targetValue: v }))}
                      placeholder="100000"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Date cible</Text>
                    <TextInput
                      style={s.input}
                      value={form.targetDate}
                      onChangeText={v => setForm(f => ({ ...f, targetDate: v }))}
                      placeholder="2030-01-01"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>

                <Text style={s.label}>Notes (optionnel)</Text>
                <TextInput
                  style={[s.input, { height: 70, textAlignVertical: 'top' }]}
                  value={form.notes}
                  onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                  placeholder="Épargne mensuelle de 2000€..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setShowForm(false)} activeOpacity={0.7}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.sm }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.confirmBtn, createMutation.isPending && { opacity: 0.6 }]}
                    onPress={() => createMutation.mutate({
                      name:        form.name,
                      targetValue: parseFloat(form.targetValue),
                      currency:    'EUR',
                      targetDate:  form.targetDate ? new Date(form.targetDate).toISOString() : null,
                      notes:       form.notes || null,
                    } as any)}
                    disabled={createMutation.isPending || !form.name || !form.targetValue}
                    activeOpacity={0.8}
                  >
                    {createMutation.isPending
                      ? <ActivityIndicator color={colors.background} size="small" />
                      : <Text style={{ color: colors.background, fontWeight: '700', fontSize: fontSize.sm }}>Créer</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageTitle:  { color: colors.textPrimary, fontSize: fontSize['2xl'], fontWeight: '700', letterSpacing: -0.5 },
  pageSub:    { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },

  barBg:   { height: 6, backgroundColor: colors.surface2, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: radius.full, backgroundColor: colors.accent },

  milestonesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  milestoneChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface2, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  milestoneLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '500' },

  emptyIcon: {
    width: 56, height: 56, borderRadius: radius.xl,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },

  goalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  goalIcon:   { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  goalName:   { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600', flex: 1 },

  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },

  pmtBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.accent + '0C', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.accent + '25',
    paddingHorizontal: 10, paddingVertical: 8, marginTop: 10,
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 32, gap: 10,
  },
  modalHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700', marginBottom: 4 },

  label: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '500' },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    color: colors.textPrimary, fontSize: fontSize.sm,
  },
  cancelBtn:  { flex: 1, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center' },
})

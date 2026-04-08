import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
  TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch, formatCurrency } from '@/lib/api'

interface BudgetItem {
  id:         string
  label:      string
  amount:     number
  category:   'needs' | 'wants' | 'savings' | 'investment'
  dayOfMonth: number | null
}
interface BudgetData {
  items:  BudgetItem[]
  income: number | null
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const CAT_CFG: Record<string, { label: string; color: string; icon: IoniconsName; target: number }> = {
  needs:      { label: 'Besoins',        color: colors.accent,  icon: 'home-outline',             target: 50 },
  wants:      { label: 'Envies',         color: colors.purple,  icon: 'bag-outline',              target: 30 },
  savings:    { label: 'Épargne',        color: colors.success, icon: 'shield-checkmark-outline',  target: 10 },
  investment: { label: 'Investissement', color: '#3B82F6',      icon: 'trending-up-outline',       target: 10 },
}

const EMPTY_FORM = { label: '', amount: '', category: 'needs' as BudgetItem['category'], dayOfMonth: '' }

type Tab = 'repartition' | 'cashflow'

export default function BudgetScreen() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('repartition')

  const { data, isLoading, refetch, isRefetching } = useQuery<BudgetData>({
    queryKey: ['budget'],
    queryFn:  () => apiFetch('/api/budget/items'),
  })

  // ── Income editing ────────────────────────────────────────────────────
  const [editingIncome, setEditingIncome] = useState(false)
  const [incomeInput,   setIncomeInput]   = useState('')

  const saveIncomeMut = useMutation({
    mutationFn: (amount: number) => apiFetch('/api/budget/income', { method: 'POST', body: JSON.stringify({ amount }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); setEditingIncome(false) },
  })

  const handleSaveIncome = () => {
    const val = parseFloat(incomeInput.replace(',', '.'))
    if (!isNaN(val) && val >= 0) saveIncomeMut.mutate(val)
  }

  // ── Item modal ────────────────────────────────────────────────────────
  const [modal,        setModal]   = useState(false)
  const [editing,      setEditing] = useState<BudgetItem | null>(null)
  const [form,         setForm]    = useState(EMPTY_FORM)
  const [activeTab,    setActiveTab] = useState<BudgetItem['category']>('needs')

  const openAdd = (cat: BudgetItem['category']) => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, category: cat })
    setModal(true)
  }
  const openEdit = (item: BudgetItem) => {
    setEditing(item)
    setForm({ label: item.label, amount: String(item.amount), category: item.category, dayOfMonth: item.dayOfMonth ? String(item.dayOfMonth) : '' })
    setModal(true)
  }
  const closeModal = () => { setModal(false); setEditing(null); setForm(EMPTY_FORM) }

  const createMut = useMutation({
    mutationFn: (body: object) => apiFetch('/api/budget/items', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['budget'] }); closeModal() },
    onError:    (e: any) => Alert.alert('Erreur', e?.message ?? 'Impossible d\'ajouter le poste'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      apiFetch(`/api/budget/items/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); closeModal() },
    onError:   (e: any) => Alert.alert('Erreur', e?.message ?? 'Impossible de modifier le poste'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/budget/items/${id}`, { method: 'DELETE' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['budget'] }),
  })

  const handleSaveItem = () => {
    const amount = parseFloat(form.amount.replace(',', '.'))
    if (!form.label.trim()) { Alert.alert('Champ manquant', 'Entrez un libellé'); return }
    if (isNaN(amount) || amount <= 0) { Alert.alert('Montant invalide', 'Entrez un montant supérieur à 0'); return }
    const body = {
      label:      form.label.trim(),
      amount,
      category:   form.category,
      dayOfMonth: form.dayOfMonth ? parseInt(form.dayOfMonth) : null,
    }
    if (editing) updateMut.mutate({ id: editing.id, body })
    else createMut.mutate(body)
  }

  const handleDelete = (item: BudgetItem) => {
    Alert.alert('Supprimer', `Supprimer "${item.label}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteMut.mutate(item.id) },
    ])
  }

  // ── Computed ──────────────────────────────────────────────────────────
  const income        = data?.income ?? 0
  const items         = data?.items  ?? []
  const totals        = { needs: 0, wants: 0, savings: 0, investment: 0 } as Record<string, number>
  for (const item of items) totals[item.category] = (totals[item.category] ?? 0) + item.amount
  const totalExpenses = totals.needs + totals.wants + totals.savings + totals.investment
  const remaining     = income - totalExpenses
  const savingsRate   = income > 0 ? ((totals.savings + totals.investment) / income) * 100 : 0

  // ── Cashflow : items triés par jour du mois ──────────────────────────
  const cashflowItems = [...items].sort((a, b) => (a.dayOfMonth ?? 99) - (b.dayOfMonth ?? 99))
  let running = income
  const cashflowRows = cashflowItems.map(item => {
    running -= item.amount
    return { ...item, runningBalance: running }
  })

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Budget</Text>
        </View>

        {/* ── Onglets ─────────────────────────────────────────────────── */}
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tabBtn, tab === 'repartition' && s.tabActive]} onPress={() => setTab('repartition')}>
            <Text style={[s.tabText, tab === 'repartition' && s.tabTextActive]}>Répartition</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, tab === 'cashflow' && s.tabActive]} onPress={() => setTab('cashflow')}>
            <Text style={[s.tabText, tab === 'cashflow' && s.tabTextActive]}>Flux mensuel</Text>
          </TouchableOpacity>
        </View>

        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

        {/* ══════════════════════════════════════════════════════════════
            VUE FLUX MENSUEL
        ══════════════════════════════════════════════════════════════ */}
        {tab === 'cashflow' && data && (
          <>
            {/* Carte récap */}
            <View style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View>
                  <Text style={s.cardLabel}>Revenu mensuel</Text>
                  <Text style={s.incomeValue}>{formatCurrency(income)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.cardLabel}>Solde fin de mois</Text>
                  <Text style={[s.incomeValue, { color: remaining >= 0 ? colors.success : colors.danger }]}>
                    {formatCurrency(remaining)}
                  </Text>
                </View>
              </View>
              {/* Barre visuelle */}
              <View style={s.allocBar}>
                {(['needs', 'wants', 'savings', 'investment'] as const).map(cat => {
                  const pct = income > 0 ? (totals[cat] / income) * 100 : 0
                  return <View key={cat} style={{ flex: Math.max(pct, 1), backgroundColor: CAT_CFG[cat].color, height: 6 }} />
                })}
                {remaining > 0 && <View style={{ flex: (remaining / income) * 100, backgroundColor: colors.surface2, height: 6 }} />}
              </View>
            </View>

            {/* Timeline cashflow */}
            {cashflowItems.length === 0 ? (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}>
                <Ionicons name="calendar-outline" size={36} color={colors.textMuted} style={{ marginBottom: 10 }} />
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' }}>Aucun poste budgétaire</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 }}>Allez sur "Répartition" pour en ajouter.</Text>
              </View>
            ) : (
              <View style={s.card}>
                {/* Ligne départ */}
                <View style={s.cashflowRow}>
                  <View style={[s.cfDay, { backgroundColor: colors.success + '20' }]}>
                    <Text style={[s.cfDayText, { color: colors.success }]}>1</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cfLabel}>Revenu reçu</Text>
                  </View>
                  <Text style={[s.cfAmount, { color: colors.success }]}>+{formatCurrency(income)}</Text>
                  <Text style={[s.cfBalance, { color: colors.success }]}>{formatCurrency(income)}</Text>
                </View>
                <View style={s.cashflowSep} />

                {cashflowRows.map((item, idx) => {
                  const cfg = CAT_CFG[item.category]
                  return (
                    <View key={item.id}>
                      {idx > 0 && <View style={s.cashflowSep} />}
                      <View style={s.cashflowRow}>
                        <View style={[s.cfDay, { backgroundColor: cfg.color + '18' }]}>
                          <Text style={[s.cfDayText, { color: cfg.color }]}>
                            {item.dayOfMonth ?? '—'}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.cfLabel}>{item.label}</Text>
                          <Text style={[s.cfCat, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        <Text style={[s.cfAmount, { color: colors.danger }]}>−{formatCurrency(item.amount)}</Text>
                        <Text style={[s.cfBalance, { color: item.runningBalance >= 0 ? colors.textSecondary : colors.danger }]}>
                          {formatCurrency(item.runningBalance)}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VUE RÉPARTITION 50/30/20
        ══════════════════════════════════════════════════════════════ */}
        {tab === 'repartition' && (
          <>
        {/* ── Revenu mensuel ──────────────────────────────────────────── */}
        {data && (
          <View style={s.card}>
            <View style={s.incomeRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardLabel}>Revenu mensuel</Text>
                {editingIncome ? (
                  <View style={s.incomeEditRow}>
                    <TextInput
                      style={s.incomeInput}
                      value={incomeInput}
                      onChangeText={setIncomeInput}
                      keyboardType="decimal-pad"
                      autoFocus
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      returnKeyType="done"
                      onSubmitEditing={handleSaveIncome}
                    />
                    <TouchableOpacity onPress={handleSaveIncome} style={s.incomeSaveBtn}>
                      <Ionicons name="checkmark" size={18} color={colors.background} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingIncome(false)} style={s.incomeCancelBtn}>
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => { setIncomeInput(String(income)); setEditingIncome(true) }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <Text style={s.incomeValue}>{formatCurrency(income)}</Text>
                    <Ionicons name="pencil-outline" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.rateBox}>
                <Text style={[s.rateValue, {
                  color: savingsRate >= 20 ? colors.success : savingsRate >= 10 ? colors.accent : colors.danger,
                }]}>
                  {savingsRate.toFixed(1)}%
                </Text>
                <Text style={s.rateLabel}>épargne</Text>
              </View>
            </View>
            {/* Barre 50/30/20 */}
            <View style={s.allocBar}>
              {(['needs', 'wants', 'savings', 'investment'] as const).map(cat => {
                const pct = income > 0 ? (totals[cat] / income) * 100 : 0
                return <View key={cat} style={{ flex: Math.max(pct, 2), backgroundColor: CAT_CFG[cat].color, height: 4 }} />
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              {(['needs', 'wants', 'savings', 'investment'] as const).map(cat => {
                const pct = income > 0 ? Math.round((totals[cat] / income) * 100) : 0
                return (
                  <View key={cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CAT_CFG[cat].color }} />
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{CAT_CFG[cat].label} {pct}%</Text>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* ── Cards par catégorie ──────────────────────────────────────── */}
        {data && (['needs', 'wants', 'savings', 'investment'] as const).map(cat => {
          const cfg    = CAT_CFG[cat]
          const actual = totals[cat] ?? 0
          const target = (income * cfg.target) / 100
          const pct    = income > 0 ? (actual / income) * 100 : 0
          const ok     = Math.abs(actual - target) < target * 0.15

          return (
            <View key={cat} style={[s.card, { borderColor: ok ? colors.border : colors.danger + '50' }]}>
              <View style={s.catHeader}>
                <View style={[s.catIcon, { backgroundColor: cfg.color + '18' }]}>
                  <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.catTitle}>{cfg.label}</Text>
                    <Text style={[s.catTarget, { backgroundColor: cfg.color + '18', color: cfg.color }]}>
                      {cfg.target}%
                    </Text>
                  </View>
                  <Text style={s.catSub}>{formatCurrency(actual)} / {formatCurrency(target)}</Text>
                </View>
                <Text style={[s.catPct, { color: cfg.color }]}>{pct.toFixed(1)}%</Text>
              </View>

              <View style={s.barBg}>
                <View style={[s.barFill, {
                  width: `${Math.min(pct / cfg.target * 100, 100)}%` as any,
                  backgroundColor: cfg.color,
                }]} />
              </View>

              {/* Items */}
              {items.filter(i => i.category === cat).length > 0 && (
                <View style={{ gap: 2, marginTop: 12 }}>
                  {items.filter(i => i.category === cat).map(item => (
                    <TouchableOpacity key={item.id} style={s.itemRow} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
                      <Text style={s.itemLabel}>{item.label}</Text>
                      {item.dayOfMonth && (
                        <Text style={s.itemDay}>J-{item.dayOfMonth}</Text>
                      )}
                      <Text style={s.itemAmount}>{formatCurrency(item.amount)}</Text>
                      <TouchableOpacity onPress={() => handleDelete(item)} style={{ marginLeft: 8, padding: 2 }}>
                        <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity style={s.addItemBtn} onPress={() => openAdd(cat)}>
                <Ionicons name="add" size={16} color={cfg.color} />
                <Text style={[s.addItemText, { color: cfg.color }]}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          )
        })}

        {/* ── Solde restant ───────────────────────────────────────────── */}
        {data && (
          <View style={[s.card, {
            borderColor:     remaining >= 0 ? colors.success + '40' : colors.danger + '40',
            backgroundColor: remaining >= 0 ? colors.success + '08' : colors.danger + '08',
          }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={[s.catIcon, { backgroundColor: (remaining >= 0 ? colors.success : colors.danger) + '20' }]}>
                <Ionicons
                  name={remaining >= 0 ? 'checkmark-circle-outline' : 'warning-outline'}
                  size={18}
                  color={remaining >= 0 ? colors.success : colors.danger}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: remaining >= 0 ? colors.success : colors.danger, fontWeight: '700', fontSize: fontSize.md }}>
                  {remaining >= 0
                    ? `+${formatCurrency(remaining)} non alloués`
                    : `Déficit de ${formatCurrency(Math.abs(remaining))}`}
                </Text>
                {remaining > 0 && (
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 3 }}>
                    Sur 20 ans à 8% → {formatCurrency(Math.round(remaining * ((Math.pow(1 + 0.08 / 12, 240) - 1) / (0.08 / 12))))}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
          </>
        )}
      </ScrollView>

      {/* ── Modal ajout / édition ────────────────────────────────────── */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={closeModal} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ justifyContent: 'flex-end', flex: 1 }}
          >
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{editing ? 'Modifier le poste' : 'Nouveau poste'}</Text>

            {/* Catégorie — grille 2×2 */}
            <Text style={s.fieldLabel}>Catégorie</Text>
            <View style={s.segGrid}>
              {(['needs', 'wants', 'savings', 'investment'] as const).map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[s.seg, form.category === cat && { backgroundColor: CAT_CFG[cat].color + '22', borderColor: CAT_CFG[cat].color }]}
                  onPress={() => setForm(f => ({ ...f, category: cat }))}
                >
                  <Ionicons name={CAT_CFG[cat].icon} size={14} color={form.category === cat ? CAT_CFG[cat].color : colors.textMuted} />
                  <Text style={[s.segText, form.category === cat && { color: CAT_CFG[cat].color, fontWeight: '600' }]}>
                    {CAT_CFG[cat].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Label */}
            <Text style={s.fieldLabel}>Libellé</Text>
            <TextInput
              style={s.input}
              value={form.label}
              onChangeText={v => setForm(f => ({ ...f, label: v }))}
              placeholder="Ex: PEA, Livret A…"
              placeholderTextColor={colors.textMuted}
              returnKeyType="next"
            />

            {/* Montant */}
            <Text style={s.fieldLabel}>Montant mensuel (€)</Text>
            <TextInput
              style={s.input}
              value={form.amount}
              onChangeText={v => setForm(f => ({ ...f, amount: v }))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />

            {/* Jour du mois */}
            <Text style={s.fieldLabel}>Jour du mois (optionnel)</Text>
            <TextInput
              style={s.input}
              value={form.dayOfMonth}
              onChangeText={v => setForm(f => ({ ...f, dayOfMonth: v }))}
              keyboardType="number-pad"
              placeholder="Ex: 5"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleSaveItem}
            />

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: CAT_CFG[form.category].color }]}
              onPress={handleSaveItem}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending)
                ? <ActivityIndicator color={colors.background} />
                : <Text style={s.saveBtnText}>{editing ? 'Enregistrer' : 'Ajouter'}</Text>
              }
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  pageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  pageTitle:  { color: colors.textPrimary, fontSize: fontSize['2xl'], fontWeight: '700', letterSpacing: -0.5 },

  // Tabs
  tabs:         { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.lg, padding: 3, marginBottom: 4 },
  tabBtn:       { flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: 'center' },
  tabActive:    { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText:      { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '500' },
  tabTextActive:{ color: colors.textPrimary, fontWeight: '700' },

  // Cashflow
  cashflowRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: spacing.md },
  cashflowSep:  { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 32 + 10 },
  cfDay:        { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  cfDayText:    { fontSize: fontSize.xs, fontWeight: '700' },
  cfLabel:      { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '500' },
  cfCat:        { fontSize: fontSize.xs, fontWeight: '500', marginTop: 1 },
  cfAmount:     { fontSize: fontSize.xs, fontWeight: '600', width: 80, textAlign: 'right' },
  cfBalance:    { fontSize: fontSize.xs, fontWeight: '600', width: 72, textAlign: 'right' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },

  incomeRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardLabel:      { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 3 },
  incomeValue:    { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700', letterSpacing: -0.5 },
  incomeEditRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  incomeInput:    { flex: 1, color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: colors.accent, paddingVertical: 2 },
  incomeSaveBtn:  { width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  incomeCancelBtn:{ width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },

  rateBox:  { alignItems: 'center' },
  rateValue: { fontSize: fontSize['2xl'], fontWeight: '700' },
  rateLabel: { color: colors.textMuted, fontSize: fontSize.xs },

  allocBar: { flexDirection: 'row', height: 4, borderRadius: radius.full, overflow: 'hidden', gap: 2 },

  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  catIcon:   { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  catTitle:  { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  catTarget: { fontSize: fontSize.xs, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  catSub:    { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  catPct:    { fontSize: fontSize.xl, fontWeight: '700', letterSpacing: -0.5 },

  barBg:   { height: 5, backgroundColor: colors.surface2, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: radius.full },

  itemRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  itemLabel:  { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm },
  itemDay:    { color: colors.textMuted, fontSize: fontSize.xs, marginRight: 8, backgroundColor: colors.surface2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  itemAmount: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '500', minWidth: 80, textAlign: 'right' },

  addItemBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  addItemText: { fontSize: fontSize.sm, fontWeight: '600' },

  // Modal
  backdrop:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:      { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40, gap: spacing.sm },
  sheetHandle:{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', marginBottom: 4 },

  fieldLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  input:      { backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.textPrimary, fontSize: fontSize.md, borderWidth: 1, borderColor: colors.border },

  segmented: { flexDirection: 'row', gap: 8 },
  segGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seg:        { width: '47%' as any, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  segText:    { color: colors.textSecondary, fontSize: fontSize.sm },

  saveBtn:     { borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: colors.background, fontWeight: '700', fontSize: fontSize.md },
})

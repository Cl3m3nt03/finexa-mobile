import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
  TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch, formatCurrency } from '@/lib/api'

interface Transaction {
  id:        string
  type:      'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL'
  symbol:    string | null
  name:      string | null
  quantity:  number | null
  price:     number | null
  fees:      number | null
  total:     number
  currency:  string
  date:      string
  notes:     string | null
}

type TxType = Transaction['type']
type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const TYPE_CFG: Record<TxType, { label: string; color: string; icon: IoniconsName; sign: string }> = {
  BUY:        { label: 'Achat',     color: colors.accent,  icon: 'trending-up-outline',      sign: '-' },
  SELL:       { label: 'Vente',     color: colors.danger,  icon: 'trending-down-outline',     sign: '+' },
  DIVIDEND:   { label: 'Dividende', color: colors.success, icon: 'cash-outline',              sign: '+' },
  DEPOSIT:    { label: 'Dépôt',     color: colors.success, icon: 'arrow-down-circle-outline', sign: '+' },
  WITHDRAWAL: { label: 'Retrait',   color: colors.danger,  icon: 'arrow-up-circle-outline',   sign: '-' },
}

const TYPES: TxType[] = ['BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAWAL']

const EMPTY_FORM = {
  type:     'BUY' as TxType,
  symbol:   '',
  quantity: '',
  price:    '',
  fees:     '',
  date:     new Date().toISOString().slice(0, 10),
  notes:    '',
}

export default function TransactionsScreen() {
  const qc = useQueryClient()

  const { data, isLoading, refetch, isRefetching } = useQuery<{ transactions: Transaction[] }>({
    queryKey: ['transactions'],
    queryFn:  () => apiFetch('/api/transactions?limit=100'),
  })

  // ── Filters ───────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<TxType | 'ALL'>('ALL')

  const transactions = (data?.transactions ?? []).filter(tx => filter === 'ALL' || tx.type === filter)

  // ── Group by date ─────────────────────────────────────────────────────
  const grouped: Record<string, Transaction[]> = {}
  for (const tx of transactions) {
    const key = new Date(tx.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(tx)
  }

  // ── CRUD ──────────────────────────────────────────────────────────────
  const [modal, setModal] = useState(false)
  const [form,  setForm]  = useState(EMPTY_FORM)

  const openAdd = () => { setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) }); setModal(true) }
  const closeModal = () => setModal(false)

  const createMut = useMutation({
    mutationFn: (body: object) => apiFetch('/api/transactions', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['transactions'] }); closeModal() },
    onError:    () => Alert.alert('Erreur', 'Impossible de créer la transaction.'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/transactions/${id}`, { method: 'DELETE' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })

  const handleSave = () => {
    const quantity = form.quantity ? parseFloat(form.quantity.replace(',', '.')) : null
    const price    = form.price    ? parseFloat(form.price.replace(',', '.'))    : null
    const fees     = form.fees     ? parseFloat(form.fees.replace(',', '.'))     : null
    const total    = (quantity && price) ? quantity * price : 0

    createMut.mutate({
      type:     form.type,
      symbol:   form.symbol.trim().toUpperCase() || null,
      quantity,
      price,
      fees,
      total,
      currency: 'EUR',
      date:     new Date(form.date).toISOString(),
      notes:    form.notes.trim() || null,
    })
  }

  const handleDelete = (tx: Transaction) => {
    Alert.alert('Supprimer', `Supprimer cette transaction ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteMut.mutate(tx.id) },
    ])
  }

  const needsSymbol = form.type === 'BUY' || form.type === 'SELL' || form.type === 'DIVIDEND'

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Transactions</Text>
          <TouchableOpacity onPress={openAdd} style={s.addBtn}>
            <Ionicons name="add" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* ── Filtres ──────────────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={s.filters}>
            {(['ALL', ...TYPES] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[s.chip, filter === t && { backgroundColor: t === 'ALL' ? colors.accent : TYPE_CFG[t as TxType]?.color + '22', borderColor: t === 'ALL' ? colors.accent : TYPE_CFG[t as TxType]?.color }]}
                onPress={() => setFilter(t)}
              >
                <Text style={[s.chipText, filter === t && { color: t === 'ALL' ? colors.background : TYPE_CFG[t as TxType]?.color, fontWeight: '600' }]}>
                  {t === 'ALL' ? 'Tout' : TYPE_CFG[t as TxType].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

        {transactions.length === 0 && !isLoading && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 48 }]}>
            <Ionicons name="swap-horizontal-outline" size={40} color={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.md, fontWeight: '600' }}>
              Aucune transaction
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, textAlign: 'center' }}>
              Appuyez sur + pour en ajouter une.
            </Text>
          </View>
        )}

        {/* ── Liste groupée par date ───────────────────────────────────── */}
        {Object.entries(grouped).map(([date, txs]) => (
          <View key={date}>
            <Text style={s.dateLabel}>{date}</Text>
            <View style={s.card}>
              {txs.map((tx, idx) => {
                const cfg = TYPE_CFG[tx.type] ?? TYPE_CFG.BUY
                return (
                  <View key={tx.id}>
                    {idx > 0 && <View style={s.separator} />}
                    <TouchableOpacity
                      style={s.txRow}
                      onLongPress={() => handleDelete(tx)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.txIcon, { backgroundColor: cfg.color + '18' }]}>
                        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.txName} numberOfLines={1}>
                          {tx.symbol ?? tx.name ?? cfg.label}
                        </Text>
                        <Text style={s.txMeta}>
                          {cfg.label}
                          {tx.quantity ? ` · ${tx.quantity} part${tx.quantity > 1 ? 's' : ''}` : ''}
                          {tx.price    ? ` · ${formatCurrency(tx.price)}` : ''}
                          {tx.fees     ? ` · frais ${formatCurrency(tx.fees)}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.txAmount, { color: cfg.color }]}>
                          {cfg.sign}{formatCurrency(tx.total, tx.currency)}
                        </Text>
                        <TouchableOpacity onPress={() => handleDelete(tx)} style={{ marginTop: 4 }}>
                          <Ionicons name="trash-outline" size={13} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ── Modal ajout ─────────────────────────────────────────────── */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={closeModal} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Nouvelle transaction</Text>

            {/* Type */}
            <Text style={s.fieldLabel}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeChip, form.type === t && { backgroundColor: TYPE_CFG[t].color + '22', borderColor: TYPE_CFG[t].color }]}
                    onPress={() => setForm(f => ({ ...f, type: t }))}
                  >
                    <Ionicons name={TYPE_CFG[t].icon} size={14} color={form.type === t ? TYPE_CFG[t].color : colors.textMuted} />
                    <Text style={[s.typeChipText, form.type === t && { color: TYPE_CFG[t].color, fontWeight: '600' }]}>
                      {TYPE_CFG[t].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Symbole (si applicable) */}
            {needsSymbol && (
              <>
                <Text style={s.fieldLabel}>Symbole (ex: AAPL, BTC)</Text>
                <TextInput
                  style={s.input}
                  value={form.symbol}
                  onChangeText={v => setForm(f => ({ ...f, symbol: v }))}
                  placeholder="AAPL"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              </>
            )}

            {/* Quantité & Prix */}
            {(form.type === 'BUY' || form.type === 'SELL') && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Quantité</Text>
                  <TextInput style={s.input} value={form.quantity} onChangeText={v => setForm(f => ({ ...f, quantity: v }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Prix unitaire (€)</Text>
                  <TextInput style={s.input} value={form.price} onChangeText={v => setForm(f => ({ ...f, price: v }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
                </View>
              </View>
            )}

            {/* Montant total pour DEPOSIT/WITHDRAWAL/DIVIDEND */}
            {(form.type === 'DEPOSIT' || form.type === 'WITHDRAWAL' || form.type === 'DIVIDEND') && (
              <>
                <Text style={s.fieldLabel}>Montant (€)</Text>
                <TextInput style={s.input} value={form.price} onChangeText={v => setForm(f => ({ ...f, price: v }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
              </>
            )}

            {/* Frais */}
            {(form.type === 'BUY' || form.type === 'SELL') && (
              <>
                <Text style={s.fieldLabel}>Frais (€, optionnel)</Text>
                <TextInput style={s.input} value={form.fees} onChangeText={v => setForm(f => ({ ...f, fees: v }))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
              </>
            )}

            {/* Date */}
            <Text style={s.fieldLabel}>Date (AAAA-MM-JJ)</Text>
            <TextInput style={s.input} value={form.date} onChangeText={v => setForm(f => ({ ...f, date: v }))} placeholder="2025-01-01" placeholderTextColor={colors.textMuted} />

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: TYPE_CFG[form.type].color }]}
              onPress={handleSave}
              disabled={createMut.isPending}
            >
              {createMut.isPending
                ? <ActivityIndicator color={colors.background} />
                : <Text style={s.saveBtnText}>Enregistrer</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.sm, paddingBottom: 40 },

  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pageTitle:  { color: colors.textPrimary, fontSize: fontSize['2xl'], fontWeight: '700', letterSpacing: -0.5 },
  addBtn:     { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },

  filters:    { flexDirection: 'row', gap: 8, paddingBottom: 8 },
  chip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  chipText:   { color: colors.textSecondary, fontSize: fontSize.sm },

  dateLabel: {
    color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600',
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: 4, paddingLeft: 4,
  },

  card:      { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 68 },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: spacing.md },
  txIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  txName:   { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '500' },
  txMeta:   { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  txAmount: { fontSize: fontSize.sm, fontWeight: '700' },

  // Modal
  backdrop:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40, gap: spacing.sm },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  sheetTitle:  { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', marginBottom: 4 },

  fieldLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  input:      { backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.textPrimary, fontSize: fontSize.md, borderWidth: 1, borderColor: colors.border },

  typeChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  typeChipText: { color: colors.textSecondary, fontSize: fontSize.sm },

  saveBtn:     { borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: colors.background, fontWeight: '700', fontSize: fontSize.md },
})

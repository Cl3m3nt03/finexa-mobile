import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, Image, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch, formatCurrency } from '@/lib/api'
import { API_BASE } from '@/constants/api'
import { getToken } from '@/lib/auth'

interface PokemonItem {
  id:              string
  itemType:        'card' | 'sealed'
  name:            string
  setName:         string | null
  language:        string
  imageUrl:        string | null
  rarity:          string | null
  condition:       string | null
  isReverse:       boolean
  isGraded:        boolean
  gradeLabel:      string | null
  quantity:        number
  purchasePrice:   number
  currentPrice:    number | null
  lastPriceAt:     string | null
  currency:        string
  notes:           string | null
}

interface SearchResult {
  id:         string
  name:       string
  setName:    string
  number?:    string
  rarity?:    string
  imageUrl:   string
  trendPrice: number | null
  type:       'card' | 'sealed'
}

const LANGUAGES  = ['FR', 'EN', 'JP', 'DE']
const CONDITIONS = ['NM', 'EX', 'GD', 'LP', 'PO']

export default function PokemonScreen() {
  const queryClient = useQueryClient()

  const [showForm, setShowForm]   = useState(false)
  const [searchQ, setSearchQ]     = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults]     = useState<SearchResult[]>([])
  const [selected, setSelected]   = useState<SearchResult | null>(null)

  const [form, setForm] = useState({
    language:      'FR',
    condition:     'NM',
    quantity:      '1',
    purchasePrice: '',
    isReverse:     false,
    isGraded:      false,
    gradeLabel:    '',
    notes:         '',
  })

  const { data: items = [], isLoading, refetch, isRefetching } = useQuery<PokemonItem[]>({
    queryKey: ['pokemon-items'],
    queryFn:  () => apiFetch('/api/pokemon/items'),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => apiFetch('/api/pokemon/items', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pokemon-items'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/pokemon/items/${id}`, { method: 'DELETE' }),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['pokemon-items'] }),
  })

  const refreshMutation = useMutation({
    mutationFn: () => apiFetch<{ updated: number }>('/api/pokemon/price', { method: 'POST' }),
    onSuccess:  (data) => {
      queryClient.invalidateQueries({ queryKey: ['pokemon-items'] })
      Alert.alert('Mis à jour', `${data.updated} prix actualisé${data.updated > 1 ? 's' : ''}`)
    },
  })

  const totalInvested = items.reduce((s, i) => s + i.purchasePrice * i.quantity, 0)
  const totalCurrent  = items.reduce((s, i) => s + (i.currentPrice ?? i.purchasePrice) * i.quantity, 0)
  const totalGain     = totalCurrent - totalInvested
  const isPos         = totalGain >= 0

  async function doSearch() {
    if (!searchQ.trim()) return
    setSearching(true)
    try {
      const token = await getToken()
      const res = await fetch(
        `${API_BASE}/api/pokemon/search?q=${encodeURIComponent(searchQ)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      const json = await res.json()
      setResults(json.results ?? [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function selectCard(card: SearchResult) {
    setSelected(card)
    setForm(f => ({ ...f, purchasePrice: card.trendPrice ? String(card.trendPrice.toFixed(2)) : '' }))
  }

  function closeForm() {
    setShowForm(false)
    setSelected(null)
    setSearchQ('')
    setResults([])
    setForm({ language: 'FR', condition: 'NM', quantity: '1', purchasePrice: '', isReverse: false, isGraded: false, gradeLabel: '', notes: '' })
  }

  function handleAdd() {
    if (!selected || !form.purchasePrice) return
    createMutation.mutate({
      itemType:      selected.type,
      name:          selected.name,
      setName:       selected.setName,
      cardApiId:     selected.id,
      cardNumber:    selected.number ?? null,
      rarity:        selected.rarity ?? null,
      imageUrl:      selected.imageUrl ?? null,
      language:      form.language,
      condition:     form.condition,
      quantity:      parseInt(form.quantity) || 1,
      purchasePrice: parseFloat(form.purchasePrice.replace(',', '.')) || 0,
      isReverse:     form.isReverse,
      isGraded:      form.isGraded,
      gradeLabel:    form.isGraded ? form.gradeLabel : null,
      notes:         form.notes || null,
      currency:      'EUR',
    })
  }

  function confirmDelete(item: PokemonItem) {
    Alert.alert('Supprimer', `Supprimer "${item.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
    ])
  }

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
            <Text style={s.pageTitle}>Collection Pokémon</Text>
            <Text style={s.pageSub}>{items.length} article{items.length > 1 ? 's' : ''}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              activeOpacity={0.7}
            >
              {refreshMutation.isPending
                ? <ActivityIndicator color={colors.accent} size="small" />
                : <Ionicons name="refresh-outline" size={20} color={colors.accent} />
              }
            </TouchableOpacity>
            <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(true)} activeOpacity={0.8}>
              <Ionicons name="add" size={20} color={colors.background} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Stats ───────────────────────────────────────────────────── */}
        {items.length > 0 && (
          <View style={s.statsRow}>
            <View style={[s.statCard, { flex: 1 }]}>
              <Text style={s.statLabel}>Investi</Text>
              <Text style={s.statValue}>{formatCurrency(totalInvested)}</Text>
            </View>
            <View style={[s.statCard, { flex: 1 }]}>
              <Text style={s.statLabel}>Valeur actuelle</Text>
              <Text style={[s.statValue, { color: colors.accent }]}>{formatCurrency(totalCurrent)}</Text>
            </View>
            <View style={[s.statCard, { flex: 1 }]}>
              <Text style={s.statLabel}>Gain/Perte</Text>
              <Text style={[s.statValue, { color: isPos ? colors.success : colors.danger }]}>
                {isPos ? '+' : ''}{formatCurrency(totalGain)}
              </Text>
            </View>
          </View>
        )}

        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

        {/* ── Liste des cartes ────────────────────────────────────────── */}
        {items.map(item => {
          const current   = item.currentPrice ?? item.purchasePrice
          const invested  = item.purchasePrice * item.quantity
          const value     = current * item.quantity
          const gain      = value - invested
          const gainPct   = invested > 0 ? (gain / invested) * 100 : 0
          const itemIsPos = gain >= 0

          return (
            <View key={item.id} style={s.card}>
              <View style={s.cardRow}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={s.cardImg} resizeMode="contain" />
                ) : (
                  <View style={[s.cardImg, { backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName} numberOfLines={2}>{item.name}</Text>
                  {item.setName && <Text style={s.cardSet}>{item.setName}</Text>}
                  <View style={s.cardBadgesRow}>
                    <View style={s.badge}><Text style={s.badgeText}>{item.language}</Text></View>
                    {item.condition && <View style={s.badge}><Text style={s.badgeText}>{item.condition}</Text></View>}
                    {item.isReverse  && <View style={[s.badge, { backgroundColor: colors.purple + '18' }]}><Text style={[s.badgeText, { color: colors.purple }]}>Reverse</Text></View>}
                    {item.isGraded   && <View style={[s.badge, { backgroundColor: colors.warning + '18' }]}><Text style={[s.badgeText, { color: colors.warning }]}>{item.gradeLabel ?? 'Gradée'}</Text></View>}
                    <View style={s.badge}><Text style={s.badgeText}>×{item.quantity}</Text></View>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={s.cardValue}>{formatCurrency(value)}</Text>
                  <View style={[s.gainBadge, { backgroundColor: itemIsPos ? colors.success + '18' : colors.danger + '18' }]}>
                    <Text style={{ color: itemIsPos ? colors.success : colors.danger, fontSize: 10, fontWeight: '700' }}>
                      {itemIsPos ? '+' : ''}{gainPct.toFixed(1)}%
                    </Text>
                  </View>
                  {item.currentPrice && (
                    <Text style={s.priceText}>{formatCurrency(item.currentPrice)}/u</Text>
                  )}
                  <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={14} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )
        })}

        {!isLoading && items.length === 0 && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 48 }]}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🎴</Text>
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.md, fontWeight: '600' }}>
              Collection vide
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, textAlign: 'center' }}>
              Ajoutez vos cartes et boosters pour suivre la valeur de votre collection.
            </Text>
            <TouchableOpacity style={[s.addBtn, { marginTop: 20 }]} onPress={() => setShowForm(true)}>
              <Ionicons name="add" size={18} color={colors.background} />
              <Text style={{ color: colors.background, fontSize: fontSize.sm, fontWeight: '700' }}>Ajouter une carte</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Modal ajout ──────────────────────────────────────────────── */}
      <Modal visible={showForm} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={s.overlay} onPress={closeForm} activeOpacity={1}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={s.sheet}>
                <View style={s.handle} />
                <Text style={s.sheetTitle}>Ajouter une carte</Text>

                {/* Search */}
                {!selected && (
                  <>
                    <View style={s.searchRow}>
                      <TextInput
                        style={[s.input, { flex: 1 }]}
                        value={searchQ}
                        onChangeText={setSearchQ}
                        onSubmitEditing={doSearch}
                        placeholder="Charizard, Pikachu VMAX..."
                        placeholderTextColor={colors.textMuted}
                        returnKeyType="search"
                      />
                      <TouchableOpacity style={s.searchBtn} onPress={doSearch} activeOpacity={0.7}>
                        {searching
                          ? <ActivityIndicator color={colors.background} size="small" />
                          : <Ionicons name="search" size={16} color={colors.background} />
                        }
                      </TouchableOpacity>
                    </View>

                    {results.length > 0 && (
                      <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                        {results.map(r => (
                          <TouchableOpacity
                            key={r.id}
                            style={s.resultRow}
                            onPress={() => selectCard(r)}
                            activeOpacity={0.7}
                          >
                            {r.imageUrl ? (
                              <Image source={{ uri: r.imageUrl }} style={s.resultImg} resizeMode="contain" />
                            ) : (
                              <View style={[s.resultImg, { backgroundColor: colors.surface2 }]} />
                            )}
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' }} numberOfLines={1}>{r.name}</Text>
                              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{r.setName}</Text>
                            </View>
                            {r.trendPrice !== null && (
                              <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontWeight: '700' }}>
                                {formatCurrency(r.trendPrice)}
                              </Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </>
                )}

                {/* Card selected — form */}
                {selected && (
                  <>
                    <View style={s.selectedCard}>
                      {selected.imageUrl && (
                        <Image source={{ uri: selected.imageUrl }} style={s.selectedImg} resizeMode="contain" />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' }} numberOfLines={2}>
                          {selected.name}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>{selected.setName}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setSelected(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.label}>Prix d'achat (€) *</Text>
                        <TextInput
                          style={s.input}
                          value={form.purchasePrice}
                          onChangeText={v => setForm(f => ({ ...f, purchasePrice: v }))}
                          placeholder="5.00"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.label}>Quantité</Text>
                        <TextInput
                          style={s.input}
                          value={form.quantity}
                          onChangeText={v => setForm(f => ({ ...f, quantity: v }))}
                          placeholder="1"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <Text style={s.label}>Langue</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                      {LANGUAGES.map(l => (
                        <TouchableOpacity
                          key={l}
                          style={[s.chip, form.language === l && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                          onPress={() => setForm(f => ({ ...f, language: l }))}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: form.language === l ? colors.accent : colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' }}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={s.label}>État</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                      {CONDITIONS.map(c => (
                        <TouchableOpacity
                          key={c}
                          style={[s.chip, form.condition === c && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                          onPress={() => setForm(f => ({ ...f, condition: c }))}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: form.condition === c ? colors.accent : colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' }}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        onPress={() => setForm(f => ({ ...f, isReverse: !f.isReverse }))}
                        activeOpacity={0.7}
                      >
                        <View style={[s.checkbox, form.isReverse && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                          {form.isReverse && <Ionicons name="checkmark" size={12} color={colors.background} />}
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Reverse</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        onPress={() => setForm(f => ({ ...f, isGraded: !f.isGraded }))}
                        activeOpacity={0.7}
                      >
                        <View style={[s.checkbox, form.isGraded && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                          {form.isGraded && <Ionicons name="checkmark" size={12} color={colors.background} />}
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Gradée</Text>
                      </TouchableOpacity>
                    </View>

                    {form.isGraded && (
                      <>
                        <Text style={s.label}>Note (ex: PSA 10)</Text>
                        <TextInput
                          style={s.input}
                          value={form.gradeLabel}
                          onChangeText={v => setForm(f => ({ ...f, gradeLabel: v }))}
                          placeholder="PSA 10"
                          placeholderTextColor={colors.textMuted}
                        />
                      </>
                    )}
                  </>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity style={s.cancelBtn} onPress={closeForm} activeOpacity={0.7}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.sm }}>Annuler</Text>
                  </TouchableOpacity>
                  {selected && (
                    <TouchableOpacity
                      style={[s.confirmBtn, (createMutation.isPending || !form.purchasePrice) && { opacity: 0.6 }]}
                      onPress={handleAdd}
                      disabled={createMutation.isPending || !form.purchasePrice}
                      activeOpacity={0.8}
                    >
                      {createMutation.isPending
                        ? <ActivityIndicator color={colors.background} size="small" />
                        : <Text style={{ color: colors.background, fontWeight: '700', fontSize: fontSize.sm }}>Ajouter</Text>
                      }
                    </TouchableOpacity>
                  )}
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
  pageSub:    { color: colors.textMuted,   fontSize: fontSize.sm, marginTop: 2 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
  },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  statLabel: { color: colors.textMuted,   fontSize: fontSize.xs, marginBottom: 4 },
  statValue: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  cardRow:    { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardImg:    { width: 56, height: 78, borderRadius: radius.sm },
  cardName:   { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  cardSet:    { color: colors.textMuted,   fontSize: fontSize.xs, marginTop: 2 },
  cardBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  badge:         { backgroundColor: colors.surface2, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:     { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  cardValue:  { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
  gainBadge:  { borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  priceText:  { color: colors.textMuted,  fontSize: 10 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 32, gap: 10, maxHeight: '90%',
  },
  handle:     { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700' },

  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '60',
  },
  resultImg: { width: 32, height: 44, borderRadius: radius.sm },

  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface2, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 10,
  },
  selectedImg: { width: 40, height: 56, borderRadius: radius.sm },

  label: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '500' },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    color: colors.textPrimary, fontSize: fontSize.sm,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn:  { flex: 1, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center' },
})

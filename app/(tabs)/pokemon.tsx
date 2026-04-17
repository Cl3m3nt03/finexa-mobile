import { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, Image, useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Polyline, Polygon, Text as SvgText } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch, formatCurrency } from '@/lib/api'
import { API_BASE } from '@/constants/api'
import { getToken } from '@/lib/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  sealedType:      string | null
  quantity:        number
  purchasePrice:   number
  currentPrice:    number | null
  lastPriceAt:     string | null
  purchasedAt:     string | null
  currency:        string
  notes:           string | null
  ebaySearchQuery: string | null
  manualPrice:     number | null
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

interface PricePoint      { price: number; recordedAt: string }
interface PortfolioPoint  { date: string; value: number; cost: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES    = ['FR', 'EN', 'JP', 'DE', 'ES', 'IT', 'KO']
const CONDITIONS   = ['MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO']
const SEALED_TYPES = ['ETB', 'Display', 'Booster', 'Bundle', 'Coffret', 'Tin', 'Autre']

// ─── Mini Sparkline SVG ───────────────────────────────────────────────────────

function MiniSparkline({ data, width = 260, height = 52 }: { data: PricePoint[]; width?: number; height?: number }) {
  if (data.length < 2) return null
  const PAD = 4
  const prices = data.map(d => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (width - PAD * 2)
    const y = PAD + (1 - (d.price - min) / range) * (height - PAD * 2)
    return `${x},${y}`
  })
  const polyline = pts.join(' ')
  const first = data[0], last = data[data.length - 1]
  const isUp = last.price >= first.price
  const color = isUp ? '#34d399' : '#f87171'
  const fillPts = `${PAD},${height - PAD} ${polyline} ${width - PAD},${height - PAD}`
  const lastPt = pts[pts.length - 1].split(',')

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.2" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Polygon points={fillPts} fill="url(#sparkFill)" />
        <Polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={parseFloat(lastPt[0])} cy={parseFloat(lastPt[1])} r="3" fill={color} />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: PAD }}>
        <Text style={{ color: colors.textMuted, fontSize: 9 }}>
          {new Date(first.recordedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
        </Text>
        <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{formatCurrency(last.price)}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 9 }}>
          {new Date(last.recordedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
        </Text>
      </View>
    </View>
  )
}

// ─── Portfolio Area Chart ─────────────────────────────────────────────────────

function PortfolioChart({ data }: { data: PortfolioPoint[] }) {
  const { width } = useWindowDimensions()
  const W = width - spacing.md * 2 - 32
  const H = 160
  const PAD = { t: 8, r: 4, b: 24, l: 44 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b

  const allValues = data.flatMap(d => [d.value, d.cost])
  const minV = Math.min(...allValues) * 0.97
  const maxV = Math.max(...allValues) * 1.03
  const range = maxV - minV || 1

  function toX(i: number) { return PAD.l + (i / (data.length - 1)) * iW }
  function toY(v: number) { return PAD.t + (1 - (v - minV) / range) * iH }

  const valuePts  = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ')
  const costPts   = data.map((d, i) => `${toX(i)},${toY(d.cost)}`).join(' ')
  const valueFill = `${PAD.l},${PAD.t + iH} ${valuePts} ${PAD.l + iW},${PAD.t + iH}`

  // Y axis labels
  const yLabels = [minV, minV + range * 0.5, maxV].map(v => ({
    y: toY(v),
    label: `${Math.round(v)}€`,
  }))

  // X axis labels (first, middle, last)
  const xLabels = [0, Math.floor(data.length / 2), data.length - 1].map(i => ({
    x: toX(i),
    label: new Date(data[i].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
  }))

  const lastPt = valuePts.split(' ').pop()!.split(',')

  return (
    <Svg width={W} height={H}>
      <Defs>
        <LinearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.accent} stopOpacity="0.2" />
          <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Y grid lines */}
      {yLabels.map((l, i) => (
        <Path key={i} d={`M${PAD.l},${l.y} L${PAD.l + iW},${l.y}`}
          stroke={colors.border} strokeWidth="0.5" strokeDasharray="3,3" />
      ))}

      {/* Cost dashed line */}
      <Polyline points={costPts} fill="none" stroke={colors.textMuted}
        strokeWidth="1.5" strokeDasharray="4,3" />

      {/* Value area + line */}
      <Polygon points={valueFill} fill="url(#valueGrad)" />
      <Polyline points={valuePts} fill="none" stroke={colors.accent}
        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={parseFloat(lastPt[0])} cy={parseFloat(lastPt[1])}
        r="3.5" fill={colors.accent} stroke={colors.surface} strokeWidth="1.5" />

      {/* Y labels */}
      {yLabels.map((l, i) => (
        <SvgText key={i} x="2" y={l.y + 3.5}
          fill={colors.textMuted} fontSize="8" textAnchor="start">
          {l.label}
        </SvgText>
      ))}

      {/* X labels */}
      {xLabels.map((l, i) => (
        <SvgText key={i} x={l.x} y={H - 4}
          fill={colors.textMuted} fontSize="8" textAnchor="middle">
          {l.label}
        </SvgText>
      ))}
    </Svg>
  )
}

// ─── Item Sparkline Row ───────────────────────────────────────────────────────

function ItemSparklineRow({ item }: { item: PokemonItem }) {
  const { width } = useWindowDimensions()
  const sparkW = width - spacing.md * 2 - 100

  const { data: history = [] } = useQuery<PricePoint[]>({
    queryKey: ['pokemon-price-history', item.id],
    queryFn: () => apiFetch(`/api/pokemon/items/${item.id}/price-history`),
  })

  const current = item.manualPrice ?? item.currentPrice ?? item.purchasePrice
  const pnlPct  = item.purchasePrice > 0 ? ((current - item.purchasePrice) / item.purchasePrice) * 100 : 0
  const isUp    = pnlPct >= 0

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
      borderBottomWidth: 1, borderBottomColor: colors.border + '40' }}>
      {item.imageUrl
        ? <Image source={{ uri: item.imageUrl }} style={{ width: 36, height: 50, borderRadius: radius.sm }} resizeMode="contain" />
        : <View style={{ width: 36, height: 50, borderRadius: radius.sm, backgroundColor: colors.surface2,
            alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="image-outline" size={16} color={colors.textMuted} />
          </View>
      }
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: '600' }} numberOfLines={1}>{item.name}</Text>
        {history.length >= 2
          ? <MiniSparkline data={history} width={sparkW} height={44} />
          : <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 4 }}>Pas encore de données</Text>
        }
      </View>
      <View style={{ alignItems: 'flex-end', minWidth: 56 }}>
        <Text style={{ color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: '700' }}>
          {formatCurrency(current * item.quantity)}
        </Text>
        <Text style={{ color: isUp ? colors.success : colors.danger, fontSize: 10, fontWeight: '700' }}>
          {isUp ? '+' : ''}{pnlPct.toFixed(1)}%
        </Text>
      </View>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PokemonScreen() {
  const queryClient = useQueryClient()
  const { width } = useWindowDimensions()

  // Tabs
  const [activeTab, setActiveTab] = useState<'cards' | 'sealed' | 'chart'>('cards')

  // Add modal
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
    sealedType:    'ETB',
    notes:         '',
  })

  // Edit modal
  const [editItem, setEditItem] = useState<PokemonItem | null>(null)
  const [editForm, setEditForm] = useState({
    quantity:       '1',
    purchasePrice:  '',
    condition:      'NM',
    language:       'FR',
    isReverse:      false,
    isGraded:       false,
    gradeLabel:     '',
    sealedType:     'ETB',
    purchasedAt:    '',
    notes:          '',
    ebaySearchQuery: '',
    manualPrice:    '',
  })

  function openEdit(item: PokemonItem) {
    setEditItem(item)
    setEditForm({
      quantity:        String(item.quantity),
      purchasePrice:   String(item.purchasePrice),
      condition:       item.condition ?? 'NM',
      language:        item.language,
      isReverse:       item.isReverse,
      isGraded:        item.isGraded,
      gradeLabel:      item.gradeLabel ?? '',
      sealedType:      item.sealedType ?? 'ETB',
      purchasedAt:     item.purchasedAt ? item.purchasedAt.slice(0, 10) : '',
      notes:           item.notes ?? '',
      ebaySearchQuery: item.ebaySearchQuery ?? '',
      manualPrice:     item.manualPrice !== null ? String(item.manualPrice) : '',
    })
  }

  // Queries
  const { data: items = [], isLoading, refetch, isRefetching } = useQuery<PokemonItem[]>({
    queryKey: ['pokemon-items'],
    queryFn:  () => apiFetch('/api/pokemon/items'),
  })

  const { data: portfolioHistory = [], isLoading: chartLoading } = useQuery<PortfolioPoint[]>({
    queryKey: ['pokemon-portfolio-history'],
    queryFn:  () => apiFetch('/api/pokemon/portfolio-history'),
    enabled:  activeTab === 'chart',
  })

  const { data: editHistory = [] } = useQuery<PricePoint[]>({
    queryKey: ['pokemon-price-history', editItem?.id],
    queryFn:  () => apiFetch(`/api/pokemon/items/${editItem!.id}/price-history`),
    enabled:  !!editItem,
  })

  // Mutations
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

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiFetch(`/api/pokemon/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pokemon-items'] })
      queryClient.invalidateQueries({ queryKey: ['pokemon-price-history', editItem?.id] })
      setEditItem(null)
    },
  })

  const refreshMutation = useMutation({
    mutationFn: () => apiFetch<{ updated: number }>('/api/pokemon/price', { method: 'POST' }),
    onSuccess:  (data) => {
      queryClient.invalidateQueries({ queryKey: ['pokemon-items'] })
      queryClient.invalidateQueries({ queryKey: ['pokemon-portfolio-history'] })
      Alert.alert('Mis à jour', `${data.updated} prix actualisé${data.updated > 1 ? 's' : ''}`)
    },
  })

  // Stats
  const totalInvested = items.reduce((s, i) => s + i.purchasePrice * i.quantity, 0)
  const totalCurrent  = items.reduce((s, i) => s + (i.manualPrice ?? i.currentPrice ?? i.purchasePrice) * i.quantity, 0)
  const totalGain     = totalCurrent - totalInvested
  const isPos         = totalGain >= 0

  const cards  = items.filter(i => i.itemType === 'card')
  const sealed = items.filter(i => i.itemType === 'sealed')
  const visibleItems = activeTab === 'cards' ? cards : activeTab === 'sealed' ? sealed : []

  // Search
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
      setResults(Array.isArray(json) ? json : [])
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
    setForm({ language: 'FR', condition: 'NM', quantity: '1', purchasePrice: '', isReverse: false, isGraded: false, gradeLabel: '', sealedType: 'ETB', notes: '' })
  }

  function handleAdd() {
    if (!selected || !form.purchasePrice) return
    createMutation.mutate({
      itemType:      selected.type,
      name:          selected.name,
      setName:       selected.setName,
      cardApiId:     selected.type === 'card' ? selected.id : null,
      pricechartingId: selected.type === 'sealed' ? selected.id : null,
      cardNumber:    selected.number ?? null,
      rarity:        selected.rarity ?? null,
      imageUrl:      selected.imageUrl ?? null,
      language:      form.language,
      condition:     selected.type === 'card' ? form.condition : null,
      sealedType:    selected.type === 'sealed' ? form.sealedType : null,
      quantity:      parseInt(form.quantity) || 1,
      purchasePrice: parseFloat(form.purchasePrice.replace(',', '.')) || 0,
      isReverse:     form.isReverse,
      isGraded:      form.isGraded,
      gradeLabel:    form.isGraded ? form.gradeLabel : null,
      notes:         form.notes || null,
      currency:      'EUR',
    })
  }

  function handleSaveEdit() {
    if (!editItem) return
    editMutation.mutate({
      id: editItem.id,
      data: {
        quantity:        editForm.quantity,
        purchasePrice:   editForm.purchasePrice,
        condition:       editItem.itemType === 'card' ? editForm.condition : undefined,
        language:        editForm.language,
        isReverse:       editItem.itemType === 'card' ? editForm.isReverse : undefined,
        isGraded:        editItem.itemType === 'card' ? editForm.isGraded : undefined,
        gradeLabel:      editItem.itemType === 'card' ? (editForm.isGraded ? editForm.gradeLabel : '') : undefined,
        sealedType:      editItem.itemType === 'sealed' ? editForm.sealedType : undefined,
        purchasedAt:     editForm.purchasedAt || null,
        notes:           editForm.notes || null,
        ebaySearchQuery: editForm.ebaySearchQuery.trim() || null,
        manualPrice:     editForm.manualPrice.trim() !== '' ? editForm.manualPrice.trim() : null,
      },
    })
  }

  function confirmDelete(item: PokemonItem) {
    Alert.alert('Supprimer', `Supprimer "${item.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteMutation.mutate(item.id) },
    ])
  }

  // ── Portfolio chart KPIs
  const chartKpis = useMemo(() => {
    if (portfolioHistory.length < 2) return null
    const first = portfolioHistory[0], last = portfolioHistory[portfolioHistory.length - 1]
    const gain = last.value - first.value
    const gainPct = first.value > 0 ? (gain / first.value) * 100 : 0
    const pnl = last.value - last.cost
    const pnlPct = last.cost > 0 ? (pnl / last.cost) * 100 : 0
    return { first, last, gain, gainPct, pnl, pnlPct, days: portfolioHistory.length }
  }, [portfolioHistory])

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.pageHeader}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.pageTitle}>Collection Pokémon</Text>
            <Text style={s.pageSub}>{items.length} article{items.length > 1 ? 's' : ''}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={s.iconBtn} onPress={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending} activeOpacity={0.7}>
              {refreshMutation.isPending
                ? <ActivityIndicator color={colors.accent} size="small" />
                : <Ionicons name="refresh-outline" size={20} color={colors.accent} />}
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
              <Text style={s.statLabel}>Valeur</Text>
              <Text style={[s.statValue, { color: colors.accent }]}>{formatCurrency(totalCurrent)}</Text>
            </View>
            <View style={[s.statCard, { flex: 1 }]}>
              <Text style={s.statLabel}>Gain</Text>
              <Text style={[s.statValue, { color: isPos ? colors.success : colors.danger }]}>
                {isPos ? '+' : ''}{formatCurrency(totalGain)}
              </Text>
            </View>
          </View>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <View style={s.tabBar}>
          {([
            { id: 'cards',  label: `Cartes (${cards.length})` },
            { id: 'sealed', label: `Scellés (${sealed.length})` },
            { id: 'chart',  label: 'Graphique' },
          ] as const).map(t => (
            <TouchableOpacity
              key={t.id}
              style={[s.tab, activeTab === t.id && s.tabActive]}
              onPress={() => setActiveTab(t.id)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, activeTab === t.id && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

        {/* ── Liste cartes / scellés ───────────────────────────────────── */}
        {(activeTab === 'cards' || activeTab === 'sealed') && (
          <>
            {!isLoading && visibleItems.length === 0 && (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 48 }]}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>🎴</Text>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.md, fontWeight: '600' }}>
                  {activeTab === 'cards' ? 'Aucune carte' : 'Aucun scellé'}
                </Text>
                <TouchableOpacity style={[s.addBtn, { marginTop: 20 }]} onPress={() => setShowForm(true)}>
                  <Ionicons name="add" size={18} color={colors.background} />
                  <Text style={{ color: colors.background, fontSize: fontSize.sm, fontWeight: '700' }}>Ajouter</Text>
                </TouchableOpacity>
              </View>
            )}

            {visibleItems.map(item => {
              const current   = item.manualPrice ?? item.currentPrice ?? item.purchasePrice
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
                        {item.isReverse && <View style={[s.badge, { backgroundColor: '#8b5cf620' }]}><Text style={[s.badgeText, { color: '#8b5cf6' }]}>Reverse</Text></View>}
                        {item.isGraded  && <View style={[s.badge, { backgroundColor: colors.warning + '20' }]}><Text style={[s.badgeText, { color: colors.warning }]}>{item.gradeLabel ?? 'Gradée'}</Text></View>}
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
                      {item.manualPrice !== null && (
                        <Text style={{ color: colors.warning, fontSize: 9 }}>Manuel</Text>
                      )}
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity onPress={() => openEdit(item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="pencil-outline" size={14} color={colors.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDelete(item)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="trash-outline" size={14} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              )
            })}
          </>
        )}

        {/* ── Graphique ────────────────────────────────────────────────── */}
        {activeTab === 'chart' && (
          <>
            {chartLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

            {!chartLoading && portfolioHistory.length === 0 && (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 48, gap: 12 }]}>
                <Ionicons name="bar-chart-outline" size={40} color={colors.textMuted} />
                <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' }}>
                  Pas encore de données
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', maxWidth: 280 }}>
                  L'historique se construit à chaque actualisation des prix.
                </Text>
                <TouchableOpacity
                  style={[s.iconBtn, { width: 'auto', paddingHorizontal: 16, flexDirection: 'row', gap: 6 }]}
                  onPress={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={16} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontWeight: '600' }}>Actualiser</Text>
                </TouchableOpacity>
              </View>
            )}

            {!chartLoading && chartKpis && (
              <>
                {/* KPIs */}
                <View style={s.statsRow}>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={s.statLabel}>Valeur</Text>
                    <Text style={[s.statValue, { color: colors.accent }]}>{formatCurrency(chartKpis.last.value)}</Text>
                  </View>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={s.statLabel}>P&L</Text>
                    <Text style={[s.statValue, { color: chartKpis.pnl >= 0 ? colors.success : colors.danger }]}>
                      {chartKpis.pnl >= 0 ? '+' : ''}{formatCurrency(chartKpis.pnl)}
                    </Text>
                  </View>
                  <View style={[s.statCard, { flex: 1 }]}>
                    <Text style={s.statLabel}>Évol. {chartKpis.days}j</Text>
                    <Text style={[s.statValue, { color: chartKpis.gain >= 0 ? colors.success : colors.danger }]}>
                      {chartKpis.gain >= 0 ? '+' : ''}{chartKpis.gainPct.toFixed(1)}%
                    </Text>
                  </View>
                </View>

                {/* Chart */}
                <View style={s.card}>
                  <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600', marginBottom: 16 }}>
                    Évolution du portfolio
                  </Text>
                  <View style={{ alignItems: 'center' }}>
                    <PortfolioChart data={portfolioHistory} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 16, height: 2, backgroundColor: colors.accent }} />
                      <Text style={{ color: colors.textMuted, fontSize: 10 }}>Valeur marché</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 16, height: 2, backgroundColor: colors.textMuted, opacity: 0.6 }} />
                      <Text style={{ color: colors.textMuted, fontSize: 10 }}>Coût total</Text>
                    </View>
                  </View>
                </View>

                {/* Per-item sparklines */}
                <View style={s.card}>
                  <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600', marginBottom: 8 }}>
                    Top items
                  </Text>
                  {items
                    .map(i => ({ ...i, val: (i.manualPrice ?? i.currentPrice ?? i.purchasePrice) * i.quantity }))
                    .sort((a, b) => b.val - a.val)
                    .slice(0, 8)
                    .map(i => <ItemSparklineRow key={i.id} item={i} />)
                  }
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Modal édition complète ────────────────────────────────────── */}
      <Modal visible={!!editItem} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={s.overlay} onPress={() => setEditItem(null)} activeOpacity={1}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[s.sheet, { maxHeight: '92%' }]}>
                <View style={s.handle} />
                <Text style={s.sheetTitle}>Modifier l'item</Text>

                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                  {editItem && (
                    <View style={{ gap: 12, paddingBottom: 16 }}>
                      {/* Preview */}
                      <View style={s.selectedCard}>
                        {editItem.imageUrl && (
                          <Image source={{ uri: editItem.imageUrl }} style={s.selectedImg} resizeMode="contain" />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' }} numberOfLines={2}>
                            {editItem.name}
                          </Text>
                          {editItem.setName && (
                            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>{editItem.setName}</Text>
                          )}
                        </View>
                      </View>

                      {/* Sparkline historique */}
                      {editHistory.length >= 2 && (
                        <View style={{ backgroundColor: colors.background, borderRadius: radius.md,
                          borderWidth: 1, borderColor: colors.border, padding: 10 }}>
                          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 6 }}>
                            Évolution du prix ({editHistory.length} points)
                          </Text>
                          <MiniSparkline data={editHistory} width={width - spacing.lg * 2 - 20} height={52} />
                        </View>
                      )}

                      {/* Section Portfolio */}
                      <Text style={s.sectionTitle}>Portfolio</Text>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.label}>Prix d'achat (€)</Text>
                          <TextInput style={s.input} value={editForm.purchasePrice}
                            onChangeText={v => setEditForm(f => ({ ...f, purchasePrice: v }))}
                            keyboardType="numeric" placeholderTextColor={colors.textMuted} placeholder="0.00" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.label}>Quantité</Text>
                          <TextInput style={s.input} value={editForm.quantity}
                            onChangeText={v => setEditForm(f => ({ ...f, quantity: v }))}
                            keyboardType="numeric" placeholderTextColor={colors.textMuted} placeholder="1" />
                        </View>
                      </View>
                      <View>
                        <Text style={s.label}>Date d'achat (AAAA-MM-JJ)</Text>
                        <TextInput style={s.input} value={editForm.purchasedAt}
                          onChangeText={v => setEditForm(f => ({ ...f, purchasedAt: v }))}
                          placeholderTextColor={colors.textMuted} placeholder="2024-12-25" />
                      </View>

                      {/* Section Carte */}
                      {editItem.itemType === 'card' && (
                        <>
                          <Text style={s.sectionTitle}>Carte</Text>
                          <Text style={s.label}>Langue</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {LANGUAGES.map(l => (
                              <TouchableOpacity key={l}
                                style={[s.chip, editForm.language === l && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                                onPress={() => setEditForm(f => ({ ...f, language: l }))} activeOpacity={0.7}>
                                <Text style={{ color: editForm.language === l ? colors.accent : colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' }}>{l}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <Text style={s.label}>État</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {CONDITIONS.map(c => (
                              <TouchableOpacity key={c}
                                style={[s.chip, editForm.condition === c && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                                onPress={() => setEditForm(f => ({ ...f, condition: c }))} activeOpacity={0.7}>
                                <Text style={{ color: editForm.condition === c ? colors.accent : colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' }}>{c}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <View style={{ flexDirection: 'row', gap: 16 }}>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                              onPress={() => setEditForm(f => ({ ...f, isReverse: !f.isReverse }))} activeOpacity={0.7}>
                              <View style={[s.checkbox, editForm.isReverse && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                                {editForm.isReverse && <Ionicons name="checkmark" size={12} color={colors.background} />}
                              </View>
                              <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Reverse</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                              onPress={() => setEditForm(f => ({ ...f, isGraded: !f.isGraded }))} activeOpacity={0.7}>
                              <View style={[s.checkbox, editForm.isGraded && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                                {editForm.isGraded && <Ionicons name="checkmark" size={12} color={colors.background} />}
                              </View>
                              <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Gradée</Text>
                            </TouchableOpacity>
                          </View>
                          {editForm.isGraded && (
                            <>
                              <Text style={s.label}>Note</Text>
                              <TextInput style={s.input} value={editForm.gradeLabel}
                                onChangeText={v => setEditForm(f => ({ ...f, gradeLabel: v }))}
                                placeholderTextColor={colors.textMuted} placeholder="PSA 10" />
                            </>
                          )}
                        </>
                      )}

                      {/* Section Scellé */}
                      {editItem.itemType === 'sealed' && (
                        <>
                          <Text style={s.sectionTitle}>Scellé</Text>
                          <Text style={s.label}>Type de produit</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {SEALED_TYPES.map(t => (
                              <TouchableOpacity key={t}
                                style={[s.chip, editForm.sealedType === t && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                                onPress={() => setEditForm(f => ({ ...f, sealedType: t }))} activeOpacity={0.7}>
                                <Text style={{ color: editForm.sealedType === t ? colors.accent : colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' }}>{t}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}

                      {/* Section Prix */}
                      <Text style={s.sectionTitle}>Prix</Text>
                      <View>
                        <Text style={s.label}>Prix manuel actuel (€)</Text>
                        <TextInput style={s.input} value={editForm.manualPrice}
                          onChangeText={v => setEditForm(f => ({ ...f, manualPrice: v }))}
                          keyboardType="numeric" placeholderTextColor={colors.textMuted} placeholder="ex: 45.00" />
                        <Text style={{ color: colors.warning, fontSize: fontSize.xs, marginTop: 4 }}>
                          Si renseigné, la maj auto est désactivée. Vide = repasser en auto.
                        </Text>
                      </View>
                      <View>
                        <Text style={s.label}>Requête eBay</Text>
                        <TextInput style={[s.input, { minHeight: 56 }]} value={editForm.ebaySearchQuery}
                          onChangeText={v => setEditForm(f => ({ ...f, ebaySearchQuery: v }))}
                          placeholderTextColor={colors.textMuted}
                          placeholder="ex: Mega Zygarde EX Full Art 120/088 FR NM" multiline />
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 }}>
                          Laisse vide pour la recherche automatique.
                        </Text>
                      </View>

                      {/* Notes */}
                      <Text style={s.sectionTitle}>Notes</Text>
                      <TextInput style={[s.input, { minHeight: 56 }]} value={editForm.notes}
                        onChangeText={v => setEditForm(f => ({ ...f, notes: v }))}
                        placeholderTextColor={colors.textMuted}
                        placeholder="Acheté à la release, lot de 3..." multiline />
                    </View>
                  )}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => setEditItem(null)} activeOpacity={0.7}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.sm }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.confirmBtn, editMutation.isPending && { opacity: 0.6 }]}
                    onPress={handleSaveEdit}
                    disabled={editMutation.isPending}
                    activeOpacity={0.8}
                  >
                    {editMutation.isPending
                      ? <ActivityIndicator color={colors.background} size="small" />
                      : <Text style={{ color: colors.background, fontWeight: '700', fontSize: fontSize.sm }}>Enregistrer</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal ajout ──────────────────────────────────────────────── */}
      <Modal visible={showForm} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={s.overlay} onPress={closeForm} activeOpacity={1}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[s.sheet, { maxHeight: '90%' }]}>
                <View style={s.handle} />
                <Text style={s.sheetTitle}>Ajouter un item</Text>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Search */}
                  {!selected && (
                    <>
                      <View style={[s.searchRow, { marginBottom: 8 }]}>
                        <TextInput
                          style={[s.input, { flex: 1 }]}
                          value={searchQ}
                          onChangeText={setSearchQ}
                          onSubmitEditing={doSearch}
                          placeholder="Charizard, Pikachu VMAX, Surging Sparks..."
                          placeholderTextColor={colors.textMuted}
                          returnKeyType="search"
                        />
                        <TouchableOpacity style={s.searchBtn} onPress={doSearch} activeOpacity={0.7}>
                          {searching
                            ? <ActivityIndicator color={colors.background} size="small" />
                            : <Ionicons name="search" size={16} color={colors.background} />}
                        </TouchableOpacity>
                      </View>
                      {results.length > 0 && (
                        <View style={{ maxHeight: 220 }}>
                          {results.map(r => (
                            <TouchableOpacity key={r.id} style={s.resultRow} onPress={() => selectCard(r)} activeOpacity={0.7}>
                              {r.imageUrl
                                ? <Image source={{ uri: r.imageUrl }} style={s.resultImg} resizeMode="contain" />
                                : <View style={[s.resultImg, { backgroundColor: colors.surface2 }]} />}
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
                        </View>
                      )}
                    </>
                  )}

                  {selected && (
                    <View style={{ gap: 10 }}>
                      <View style={s.selectedCard}>
                        {selected.imageUrl && (
                          <Image source={{ uri: selected.imageUrl }} style={s.selectedImg} resizeMode="contain" />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' }} numberOfLines={2}>{selected.name}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>{selected.setName}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelected(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.label}>Prix d'achat (€) *</Text>
                          <TextInput style={s.input} value={form.purchasePrice}
                            onChangeText={v => setForm(f => ({ ...f, purchasePrice: v }))}
                            placeholder="5.00" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.label}>Quantité</Text>
                          <TextInput style={s.input} value={form.quantity}
                            onChangeText={v => setForm(f => ({ ...f, quantity: v }))}
                            placeholder="1" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                        </View>
                      </View>

                      {selected.type === 'card' && (
                        <>
                          <Text style={s.label}>Langue</Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {LANGUAGES.slice(0, 4).map(l => (
                              <TouchableOpacity key={l}
                                style={[s.chip, form.language === l && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                                onPress={() => setForm(f => ({ ...f, language: l }))} activeOpacity={0.7}>
                                <Text style={{ color: form.language === l ? colors.accent : colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' }}>{l}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <Text style={s.label}>État</Text>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {CONDITIONS.slice(0, 5).map(c => (
                              <TouchableOpacity key={c}
                                style={[s.chip, form.condition === c && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                                onPress={() => setForm(f => ({ ...f, condition: c }))} activeOpacity={0.7}>
                                <Text style={{ color: form.condition === c ? colors.accent : colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' }}>{c}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <View style={{ flexDirection: 'row', gap: 16 }}>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                              onPress={() => setForm(f => ({ ...f, isReverse: !f.isReverse }))} activeOpacity={0.7}>
                              <View style={[s.checkbox, form.isReverse && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                                {form.isReverse && <Ionicons name="checkmark" size={12} color={colors.background} />}
                              </View>
                              <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Reverse</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                              onPress={() => setForm(f => ({ ...f, isGraded: !f.isGraded }))} activeOpacity={0.7}>
                              <View style={[s.checkbox, form.isGraded && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                                {form.isGraded && <Ionicons name="checkmark" size={12} color={colors.background} />}
                              </View>
                              <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>Gradée</Text>
                            </TouchableOpacity>
                          </View>
                          {form.isGraded && (
                            <>
                              <Text style={s.label}>Note (ex: PSA 10)</Text>
                              <TextInput style={s.input} value={form.gradeLabel}
                                onChangeText={v => setForm(f => ({ ...f, gradeLabel: v }))}
                                placeholder="PSA 10" placeholderTextColor={colors.textMuted} />
                            </>
                          )}
                        </>
                      )}

                      {selected.type === 'sealed' && (
                        <>
                          <Text style={s.label}>Type de produit</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {SEALED_TYPES.map(t => (
                              <TouchableOpacity key={t}
                                style={[s.chip, form.sealedType === t && { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}
                                onPress={() => setForm(f => ({ ...f, sealedType: t }))} activeOpacity={0.7}>
                                <Text style={{ color: form.sealedType === t ? colors.accent : colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' }}>{t}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </ScrollView>

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

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  backBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  pageTitle:  { color: colors.textPrimary, fontSize: fontSize['2xl'], fontWeight: '700', letterSpacing: -0.5 },
  pageSub:    { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
  },

  // Tabs
  tabBar:       { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.lg, padding: 4, gap: 2 },
  tab:          { flex: 1, paddingVertical: 8, borderRadius: radius.md, alignItems: 'center' },
  tabActive:    { backgroundColor: colors.surface },
  tabText:      { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '500' },
  tabTextActive:{ color: colors.textPrimary, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  statLabel: { color: colors.textMuted,   fontSize: fontSize.xs, marginBottom: 4 },
  statValue: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },

  sectionTitle: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  cardRow:       { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardImg:       { width: 56, height: 78, borderRadius: radius.sm },
  cardName:      { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  cardSet:       { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  cardBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  badge:         { backgroundColor: colors.surface2, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:     { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  cardValue:     { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
  gainBadge:     { borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 32, gap: 10,
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

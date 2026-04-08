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

interface Asset {
  id:          string
  name:        string
  type:        string
  value:       number
  currency:    string
  institution: string | null
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const TYPE_CFG: Record<string, { label: string; color: string; icon: IoniconsName }> = {
  BANK_ACCOUNT: { label: 'Compte',      color: colors.accent,  icon: 'card-outline'             },
  SAVINGS:      { label: 'Épargne',     color: '#06B6D4',      icon: 'shield-checkmark-outline'  },
  REAL_ESTATE:  { label: 'Immobilier',  color: '#F97316',      icon: 'home-outline'             },
  STOCK:        { label: 'Bourse',      color: '#3B82F6',      icon: 'bar-chart-outline'        },
  CRYPTO:       { label: 'Crypto',      color: '#8B5CF6',      icon: 'logo-bitcoin'             },
  PEA:          { label: 'PEA',         color: colors.accent,  icon: 'trending-up-outline'      },
  CTO:          { label: 'CTO',         color: '#A78BFA',      icon: 'stats-chart-outline'      },
  OTHER:        { label: 'Autre',       color: colors.textMuted, icon: 'ellipsis-horizontal-outline' },
}

const ALL_TYPES = Object.entries(TYPE_CFG).map(([value, cfg]) => ({ value, label: cfg.label }))

const EMPTY_FORM = { name: '', type: 'BANK_ACCOUNT', value: '', institution: '', currency: 'EUR' }

export default function AssetsScreen() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm]       = useState(false)
  const [editAsset, setEditAsset]     = useState<Asset | null>(null)
  const [form, setForm]               = useState(EMPTY_FORM)

  const { data: assets = [], isLoading, refetch, isRefetching } = useQuery<Asset[]>({
    queryKey: ['assets'],
    queryFn:  () => apiFetch('/api/assets'),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      apiFetch('/api/assets', {
        method:  'POST',
        body:    JSON.stringify({ ...data, value: parseFloat(data.value.replace(',', '.')) || 0 }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      closeForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM & { id: string }) =>
      apiFetch(`/api/assets/${data.id}`, {
        method:  'PATCH',
        body:    JSON.stringify({ name: data.name, type: data.type, value: parseFloat(data.value.replace(',', '.')) || 0, institution: data.institution, currency: data.currency }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/assets/${id}`, { method: 'DELETE' }),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  function openCreate() {
    setEditAsset(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(asset: Asset) {
    setEditAsset(asset)
    setForm({
      name:        asset.name,
      type:        asset.type,
      value:       String(asset.value),
      institution: asset.institution ?? '',
      currency:    asset.currency,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditAsset(null)
    setForm(EMPTY_FORM)
  }

  function handleSubmit() {
    if (!form.name || !form.value) return
    if (editAsset) {
      updateMutation.mutate({ ...form, id: editAsset.id })
    } else {
      createMutation.mutate(form)
    }
  }

  function confirmDelete(asset: Asset) {
    Alert.alert('Supprimer', `Supprimer "${asset.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteMutation.mutate(asset.id) },
    ])
  }

  const total    = assets.reduce((sum, a) => sum + a.value, 0)
  const grouped  = assets.reduce((acc, a) => {
    if (!acc[a.type]) acc[a.type] = []
    acc[a.type].push(a)
    return acc
  }, {} as Record<string, Asset[]>)

  const isPending = createMutation.isPending || updateMutation.isPending

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
            <Text style={s.pageTitle}>Mes actifs</Text>
            <Text style={s.pageSub}>{assets.length} actif{assets.length > 1 ? 's' : ''} · {formatCurrency(total)}</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openCreate} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color={colors.background} />
          </TouchableOpacity>
        </View>

        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

        {/* ── Grouped by type ─────────────────────────────────────────── */}
        {Object.entries(grouped).map(([type, list]) => {
          const cfg  = TYPE_CFG[type] ?? TYPE_CFG.OTHER
          const subtotal = list.reduce((s, a) => s + a.value, 0)
          return (
            <View key={type} style={s.card}>
              <View style={s.groupHeader}>
                <View style={[s.groupIcon, { backgroundColor: cfg.color + '18' }]}>
                  <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                </View>
                <Text style={[s.groupLabel, { color: cfg.color }]}>{cfg.label}</Text>
                <Text style={s.groupTotal}>{formatCurrency(subtotal)}</Text>
              </View>

              {list.map((asset, idx) => (
                <View key={asset.id}>
                  {idx > 0 && <View style={s.sep} />}
                  <View style={s.assetRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.assetName}>{asset.name}</Text>
                      {asset.institution && (
                        <Text style={s.assetInst}>{asset.institution}</Text>
                      )}
                    </View>
                    <Text style={s.assetValue}>{formatCurrency(asset.value, asset.currency)}</Text>
                    <TouchableOpacity onPress={() => openEdit(asset)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 10 }}>
                      <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete(asset)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 8 }}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )
        })}

        {!isLoading && assets.length === 0 && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 48 }]}>
            <Ionicons name="wallet-outline" size={40} color={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.md, fontWeight: '600' }}>
              Aucun actif
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, textAlign: 'center' }}>
              Ajoutez vos comptes, épargne, biens immobiliers...
            </Text>
            <TouchableOpacity style={[s.addBtn, { marginTop: 20 }]} onPress={openCreate}>
              <Ionicons name="add" size={18} color={colors.background} />
              <Text style={{ color: colors.background, fontSize: fontSize.sm, fontWeight: '700' }}>Ajouter un actif</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Modal formulaire ─────────────────────────────────────────────── */}
      <Modal visible={showForm} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={s.overlay} onPress={closeForm} activeOpacity={1}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={s.sheet}>
                <View style={s.handle} />
                <Text style={s.sheetTitle}>{editAsset ? 'Modifier l\'actif' : 'Nouvel actif'}</Text>

                <Text style={s.label}>Nom *</Text>
                <TextInput
                  style={s.input}
                  value={form.name}
                  onChangeText={v => setForm(f => ({ ...f, name: v }))}
                  placeholder="Livret A, Appartement Paris..."
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={s.label}>Valeur (€) *</Text>
                <TextInput
                  style={s.input}
                  value={form.value}
                  onChangeText={v => setForm(f => ({ ...f, value: v }))}
                  placeholder="10000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />

                <Text style={s.label}>Établissement</Text>
                <TextInput
                  style={s.input}
                  value={form.institution}
                  onChangeText={v => setForm(f => ({ ...f, institution: v }))}
                  placeholder="BNP, Boursorama..."
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={s.label}>Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                    {ALL_TYPES.map(t => {
                      const cfg    = TYPE_CFG[t.value]
                      const active = form.type === t.value
                      return (
                        <TouchableOpacity
                          key={t.value}
                          style={[s.typeChip, active && { backgroundColor: cfg.color + '20', borderColor: cfg.color }]}
                          onPress={() => setForm(f => ({ ...f, type: t.value }))}
                          activeOpacity={0.7}
                        >
                          <Ionicons name={cfg.icon} size={12} color={active ? cfg.color : colors.textMuted} />
                          <Text style={{ color: active ? cfg.color : colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' }}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity style={s.cancelBtn} onPress={closeForm} activeOpacity={0.7}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.sm }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.confirmBtn, isPending && { opacity: 0.6 }]}
                    onPress={handleSubmit}
                    disabled={isPending || !form.name || !form.value}
                    activeOpacity={0.8}
                  >
                    {isPending
                      ? <ActivityIndicator color={colors.background} size="small" />
                      : <Text style={{ color: colors.background, fontWeight: '700', fontSize: fontSize.sm }}>
                          {editAsset ? 'Enregistrer' : 'Ajouter'}
                        </Text>
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
  pageSub:    { color: colors.textMuted,   fontSize: fontSize.sm, marginTop: 2 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingHorizontal: 14, paddingVertical: 8,
  },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  groupIcon:   { width: 26, height: 26, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  groupLabel:  { flex: 1, fontSize: fontSize.sm, fontWeight: '700' },
  groupTotal:  { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },

  sep:          { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  assetRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  assetName:    { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '500' },
  assetInst:    { color: colors.textMuted,   fontSize: fontSize.xs, marginTop: 1 },
  assetValue:   { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600', minWidth: 90, textAlign: 'right' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 32, gap: 10,
  },
  handle:     { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700', marginBottom: 4 },

  label: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '500' },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    color: colors.textPrimary, fontSize: fontSize.sm,
  },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2,
  },
  cancelBtn:  { flex: 1, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center' },
})

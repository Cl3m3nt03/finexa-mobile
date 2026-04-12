import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch, formatCurrency } from '@/lib/api'

interface SnapshotHolding {
  id:            string
  symbol:        string
  name:          string
  quantity:      number
  avgBuyPrice:   number
  lastPrice:     number | null
  snapshotDate:  string
  snapshotLabel: string
}

interface Snapshot {
  label:    string
  date:     string
  holdings: SnapshotHolding[]
}

interface Props {
  visible:   boolean
  assetId:   string
  assetName: string
  onClose:   () => void
}

function fmt(n: number, d = 2) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function DeltaBadge({ delta, suffix = '€' }: { delta: number | null; suffix?: string }) {
  if (delta === null || Math.abs(delta) < 0.001) return null
  const pos = delta > 0
  return (
    <Text style={[s.delta, pos ? s.deltaPos : s.deltaNeg]}>
      {pos ? '+' : ''}{fmt(delta)} {suffix}
    </Text>
  )
}

function SymbolTimeline({ symbol, name, snapshots, onDeleteSnap, confirmLabel }: {
  symbol:       string
  name:         string
  snapshots:    Snapshot[]
  onDeleteSnap: (label: string) => void
  confirmLabel: string | null
}) {
  const [expanded, setExpanded] = useState(true)

  const entries = snapshots.map(snap => ({
    label: snap.label,
    date:  snap.date,
    h:     snap.holdings.find(x => x.symbol === symbol) ?? null,
  }))

  return (
    <View style={s.symbolCard}>
      <TouchableOpacity style={s.symbolHeader} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <View style={s.symbolIcon}>
          <Ionicons name="trending-up-outline" size={14} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.symbolName}>{name}</Text>
          <Text style={s.symbolTicker}>{symbol}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
      </TouchableOpacity>

      {expanded && entries.map((entry, i) => {
        const prev = i > 0 ? entries[i - 1].h : null
        const curr = entry.h

        const deltaQty   = curr && prev ? curr.quantity - prev.quantity : null
        const deltaPru   = curr && prev ? curr.avgBuyPrice - prev.avgBuyPrice : null
        const currVal    = curr ? (curr.lastPrice ?? curr.avgBuyPrice) * curr.quantity : null
        const prevVal    = prev ? (prev.lastPrice ?? prev.avgBuyPrice) * prev.quantity : null
        const deltaVal   = currVal != null && prevVal != null ? currVal - prevVal : null

        return (
          <View key={entry.label} style={[s.entryRow, i === 0 && s.entryFirst]}>
            <View style={s.entryLabelRow}>
              <View style={s.snapBadge}>
                <Text style={s.snapBadgeTxt}>{entry.label}</Text>
              </View>
              <Text style={s.entryDate}>
                {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
              <TouchableOpacity
                onPress={() => onDeleteSnap(entry.label)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[s.deleteBtn, confirmLabel === entry.label && s.deleteBtnActive]}
              >
                <Ionicons name="trash-outline" size={12} color={confirmLabel === entry.label ? colors.danger : colors.textMuted} />
              </TouchableOpacity>
            </View>

            {curr ? (
              <View style={s.metricsRow}>
                <View style={s.metricCell}>
                  <Text style={s.metricLabel}>Qté</Text>
                  <Text style={s.metricValue}>{curr.quantity % 1 === 0 ? curr.quantity.toFixed(0) : fmt(curr.quantity, 3)}</Text>
                  {deltaQty != null && Math.abs(deltaQty) > 0.001 && (
                    <Text style={[s.delta, deltaQty > 0 ? s.deltaPos : s.deltaNeg]}>
                      {deltaQty > 0 ? '+' : ''}{deltaQty % 1 === 0 ? deltaQty.toFixed(0) : fmt(deltaQty, 3)}
                    </Text>
                  )}
                </View>
                <View style={s.metricCell}>
                  <Text style={s.metricLabel}>PRU</Text>
                  <Text style={s.metricValue}>{fmt(curr.avgBuyPrice)} €</Text>
                  <DeltaBadge delta={deltaPru} />
                </View>
                <View style={s.metricCell}>
                  <Text style={s.metricLabel}>Cours</Text>
                  <Text style={s.metricValue}>{curr.lastPrice != null ? `${fmt(curr.lastPrice)} €` : '—'}</Text>
                </View>
                <View style={[s.metricCell, deltaVal != null && deltaVal > 0 ? s.metricPos : deltaVal != null && deltaVal < 0 ? s.metricNeg : null]}>
                  <Text style={s.metricLabel}>Valeur</Text>
                  <Text style={s.metricValue}>{currVal != null ? `${fmt(currVal)} €` : '—'}</Text>
                  <DeltaBadge delta={deltaVal} />
                </View>
              </View>
            ) : (
              <Text style={s.absent}>Absent de ce snapshot</Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

export function SnapshotHistoryModal({ visible, assetId, assetName, onClose }: Props) {
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const { data: snapshots, isLoading } = useQuery<Snapshot[]>({
    queryKey: ['snapshots', assetId],
    queryFn:  () => apiFetch(`/api/assets/${assetId}/snapshots`),
    enabled:  visible,
  })

  const deleteSnap = useMutation({
    mutationFn: (label: string) =>
      apiFetch(`/api/assets/${assetId}/snapshots?label=${encodeURIComponent(label)}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots', assetId] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setConfirmDelete(null)
    },
  })

  function handleDeleteSnap(label: string) {
    if (confirmDelete === label) {
      deleteSnap.mutate(label)
    } else {
      setConfirmDelete(label)
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  // Collect unique symbols across all snapshots
  const allSymbols: { symbol: string; name: string }[] = []
  const seen = new Set<string>()
  for (const snap of snapshots ?? []) {
    for (const h of snap.holdings) {
      if (!seen.has(h.symbol)) {
        seen.add(h.symbol)
        allSymbols.push({ symbol: h.symbol, name: h.name })
      }
    }
  }

  // Totals per snapshot
  const rawTotals = (snapshots ?? []).map(snap => ({
    label: snap.label,
    total: snap.holdings.reduce((s, h) => s + (h.lastPrice ?? h.avgBuyPrice) * h.quantity, 0),
  }))
  const isCumulative = rawTotals.length < 2 || rawTotals.every((t, i) => i === 0 || t.total >= rawTotals[i-1].total)
  const snapshotTotals = rawTotals.map((t, i) => ({
    ...t,
    display: isCumulative ? t.total : rawTotals.slice(0, i + 1).reduce((s, x) => s + x.total, 0),
  }))

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Suivi DCA</Text>
              <Text style={s.sub}>{assetName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
            {isLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
            ) : !snapshots || snapshots.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="trending-up-outline" size={40} color={colors.textMuted} />
                <Text style={s.emptyTxt}>Aucun snapshot enregistré</Text>
                <Text style={s.emptySubTxt}>Importez un CSV ou PDF pour commencer le suivi DCA</Text>
              </View>
            ) : (
              <View style={{ gap: 16, paddingBottom: 24 }}>

                {/* Totals bar */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                    {snapshotTotals.map((st, i) => {
                      const prev = i > 0 ? snapshotTotals[i-1].display : null
                      const delta = prev != null ? st.display - prev : null
                      return (
                        <View key={st.label} style={s.totalCard}>
                          <Text style={s.totalLabel}>{st.label}</Text>
                          <Text style={s.totalValue}>{formatCurrency(st.display)}</Text>
                          {delta != null && (
                            <Text style={[s.totalDelta, delta >= 0 ? s.deltaPos : s.deltaNeg]}>
                              {delta >= 0 ? '+' : ''}{fmt(delta, 0)} €
                            </Text>
                          )}
                        </View>
                      )
                    })}
                  </View>
                </ScrollView>

                {/* Per-symbol timeline */}
                {allSymbols.map(({ symbol, name }) => (
                  <SymbolTimeline
                    key={symbol}
                    symbol={symbol}
                    name={name}
                    snapshots={snapshots}
                    onDeleteSnap={handleDeleteSnap}
                    confirmLabel={confirmDelete}
                  />
                ))}

                {confirmDelete && (
                  <Text style={s.confirmHint}>
                    Tapez à nouveau sur 🗑 de <Text style={{ fontWeight: '700' }}>{confirmDelete}</Text> pour confirmer la suppression
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.closeTxt}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 24, maxHeight: '90%',
  },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },

  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  title:  { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700' },
  sub:    { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },

  emptyState:  { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTxt:    { color: colors.textSecondary, fontSize: fontSize.md, fontWeight: '600' },
  emptySubTxt: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },

  totalCard:  { backgroundColor: colors.background, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12, minWidth: 130 },
  totalLabel: { color: colors.accent, fontSize: 10, fontWeight: '700', marginBottom: 2 },
  totalValue: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totalDelta: { fontSize: fontSize.xs, fontWeight: '600', marginTop: 2 },

  symbolCard:   { backgroundColor: colors.background, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  symbolHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: colors.surface },
  symbolIcon:   { width: 30, height: 30, borderRadius: radius.md, backgroundColor: colors.accent + '15', alignItems: 'center', justifyContent: 'center' },
  symbolName:   { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  symbolTicker: { color: colors.textMuted, fontSize: 10, fontFamily: 'monospace' },

  entryRow:     { padding: 12, gap: 8 },
  entryFirst:   { borderTopWidth: 1, borderTopColor: colors.border },
  entryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  snapBadge:    { backgroundColor: colors.accent + '15', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.accent + '25' },
  snapBadgeTxt: { color: colors.accent, fontSize: 10, fontWeight: '700' },
  entryDate:    { flex: 1, color: colors.textMuted, fontSize: 10 },
  deleteBtn:    { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  deleteBtnActive: { backgroundColor: colors.danger + '20', borderRadius: radius.sm },

  metricsRow: { flexDirection: 'row', gap: 6 },
  metricCell: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 8, borderWidth: 1, borderColor: colors.border },
  metricPos:  { backgroundColor: '#10B98115', borderColor: '#10B98130' },
  metricNeg:  { backgroundColor: colors.danger + '15', borderColor: colors.danger + '30' },
  metricLabel: { color: colors.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  metricValue: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: '700', fontVariant: ['tabular-nums'] },

  delta:    { fontSize: 9, fontWeight: '600', marginTop: 2 },
  deltaPos: { color: '#10B981' },
  deltaNeg: { color: colors.danger },

  absent: { color: colors.textMuted, fontSize: fontSize.xs, fontStyle: 'italic', paddingVertical: 4 },

  confirmHint: { color: colors.danger, fontSize: fontSize.xs, textAlign: 'center', paddingVertical: 8 },

  closeBtn: { marginTop: 12, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  closeTxt: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
})

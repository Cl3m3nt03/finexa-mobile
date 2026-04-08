import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch, formatCurrency } from '@/lib/api'

interface DividendTx {
  id:    string
  price: number
  date:  string
  symbol: string | null
}

export function PassiveIncome() {
  const { data } = useQuery<DividendTx[]>({
    queryKey: ['dividends'],
    queryFn:  () => apiFetch('/api/transactions?type=DIVIDEND&limit=200'),
  })

  const oneYearAgo  = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  const last12m     = (data ?? []).filter(t => new Date(t.date) >= oneYearAgo)
  const totalAnnual = last12m.reduce((s, t) => s + t.price, 0)
  const monthlyAvg  = totalAnnual / 12

  // On n'affiche pas si aucun dividende
  if (data !== undefined && data.length === 0) return null

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="cash-outline" size={16} color={colors.success} />
        <Text style={s.title}>Revenus passifs</Text>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/portfolio' as any)}
          style={{ marginLeft: 'auto' as any }}
        >
          <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontWeight: '600' }}>Voir tout</Text>
        </TouchableOpacity>
      </View>

      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statValue}>{formatCurrency(monthlyAvg)}</Text>
          <Text style={s.statLabel}>/ mois (moy.)</Text>
        </View>
        <View style={s.divider} />
        <View style={s.stat}>
          <Text style={s.statValue}>{formatCurrency(totalAnnual)}</Text>
          <Text style={s.statLabel}>/ an (12 mois)</Text>
        </View>
        <View style={s.divider} />
        <View style={s.stat}>
          <Text style={s.statValue}>{last12m.length}</Text>
          <Text style={s.statLabel}>versements</Text>
        </View>
      </View>

      {/* Barre de progression vers liberté financière (2000€/mois) */}
      {monthlyAvg > 0 && (
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
              Liberté financière
            </Text>
            <Text style={{ color: colors.success, fontSize: fontSize.xs, fontWeight: '600' }}>
              {((monthlyAvg / 2000) * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${Math.min((monthlyAvg / 2000) * 100, 100)}%` }]} />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 3 }}>
            Objectif : 2 000 €/mois de revenus passifs
          </Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  card:    { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title:   { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },

  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat:     { flex: 1, alignItems: 'center' },
  statValue:{ color: colors.success, fontSize: fontSize.lg, fontWeight: '700', letterSpacing: -0.5 },
  statLabel:{ color: colors.textMuted, fontSize: 10, marginTop: 2 },
  divider:  { width: 1, height: 36, backgroundColor: colors.border },

  barBg:   { height: 5, backgroundColor: colors.surface2, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: 5, backgroundColor: colors.success, borderRadius: radius.full },
})

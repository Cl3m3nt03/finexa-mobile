import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { formatCurrency } from '@/lib/api'

interface BudgetItem {
  label:    string
  amount:   number
  category: 'needs' | 'wants' | 'savings' | 'investment'
}

interface Props {
  income:   number
  items:    BudgetItem[]
  totalWealth: number
}

const CAT = {
  needs:      { label: 'Besoins',        color: colors.accent,  icon: 'home-outline'             as const },
  wants:      { label: 'Envies',         color: colors.purple,  icon: 'bag-outline'              as const },
  savings:    { label: 'Épargne',        color: colors.success, icon: 'shield-checkmark-outline' as const },
  investment: { label: 'Investissement', color: '#3B82F6',      icon: 'trending-up-outline'      as const },
}

export function WealthFlow({ income, items, totalWealth }: Props) {
  if (!income || income === 0) return null

  const totals = { needs: 0, wants: 0, savings: 0, investment: 0 } as Record<string, number>
  for (const item of items) totals[item.category] = (totals[item.category] ?? 0) + item.amount
  const remaining = income - totals.needs - totals.wants - totals.savings - totals.investment

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="git-network-outline" size={16} color={colors.accent} />
        <Text style={s.title}>Flux patrimoniaux</Text>
      </View>

      {/* Source : Revenus */}
      <View style={s.sourceRow}>
        <View style={s.sourceBox}>
          <Ionicons name="wallet-outline" size={18} color={colors.accent} />
          <Text style={s.sourceLabel}>Revenus</Text>
          <Text style={s.sourceValue}>{formatCurrency(income)}</Text>
        </View>
      </View>

      {/* Flèche */}
      <View style={s.arrowRow}>
        <View style={s.arrowLine} />
        <Ionicons name="chevron-down" size={14} color={colors.border} />
      </View>

      {/* Flux par catégorie */}
      <View style={s.flowGrid}>
        {(Object.keys(CAT) as (keyof typeof CAT)[]).map(cat => {
          const cfg = CAT[cat]
          const amt = totals[cat] ?? 0
          const pct = income > 0 ? Math.round((amt / income) * 100) : 0
          return (
            <View key={cat} style={[s.flowBox, { borderColor: cfg.color + '30' }]}>
              <View style={[s.flowIcon, { backgroundColor: cfg.color + '15' }]}>
                <Ionicons name={cfg.icon} size={14} color={cfg.color} />
              </View>
              <Text style={[s.flowLabel, { color: cfg.color }]}>{cfg.label}</Text>
              <Text style={s.flowAmt}>{formatCurrency(amt)}</Text>
              <Text style={[s.flowPct, { color: cfg.color }]}>{pct}%</Text>
            </View>
          )
        })}
      </View>

      {/* Barre de répartition */}
      <View style={s.allocBar}>
        {(Object.keys(CAT) as (keyof typeof CAT)[]).map(cat => {
          const pct = income > 0 ? (totals[cat] / income) * 100 : 0
          return <View key={cat} style={{ flex: Math.max(pct, 1), backgroundColor: CAT[cat].color, height: 4 }} />
        })}
        {remaining > 0 && <View style={{ flex: (remaining / income) * 100, backgroundColor: colors.border, height: 4 }} />}
      </View>

      {/* Solde */}
      <View style={[s.soldeRow, { backgroundColor: (remaining >= 0 ? colors.success : colors.danger) + '0C' }]}>
        <Ionicons
          name={remaining >= 0 ? 'checkmark-circle-outline' : 'warning-outline'}
          size={14}
          color={remaining >= 0 ? colors.success : colors.danger}
        />
        <Text style={{ color: remaining >= 0 ? colors.success : colors.danger, fontSize: fontSize.xs, fontWeight: '600', marginLeft: 6 }}>
          {remaining >= 0 ? `+${formatCurrency(remaining)} non alloués` : `Déficit ${formatCurrency(Math.abs(remaining))}`}
        </Text>
        {totalWealth > 0 && (
          <Text style={s.wealthNote}>  ·  Patrimoine : {formatCurrency(totalWealth)}</Text>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card:    { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title:   { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },

  sourceRow: { alignItems: 'center', marginBottom: 4 },
  sourceBox: { alignItems: 'center', backgroundColor: colors.accent + '10', borderRadius: radius.lg, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: colors.accent + '30', gap: 4 },
  sourceLabel: { color: colors.textMuted, fontSize: fontSize.xs },
  sourceValue: { color: colors.accent, fontWeight: '700', fontSize: fontSize.lg, letterSpacing: -0.5 },

  arrowRow: { alignItems: 'center', paddingVertical: 4 },
  arrowLine: { width: 1, height: 10, backgroundColor: colors.border },

  flowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  flowBox:  { width: '47%' as any, alignItems: 'center', backgroundColor: colors.surface2, borderRadius: radius.md, padding: 10, borderWidth: 1, gap: 4 },
  flowIcon: { width: 28, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  flowLabel:{ fontSize: fontSize.xs, fontWeight: '600' },
  flowAmt:  { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: -0.3 },
  flowPct:  { fontSize: 10, fontWeight: '700' },

  allocBar: { flexDirection: 'row', height: 4, borderRadius: radius.full, overflow: 'hidden', gap: 2, marginBottom: 10 },

  soldeRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: 8 },
  wealthNote: { color: colors.textMuted, fontSize: fontSize.xs, marginLeft: 4 },
})

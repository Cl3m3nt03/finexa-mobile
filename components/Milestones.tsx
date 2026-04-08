import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { formatCurrency } from '@/lib/api'

const MILESTONES = [
  { value: 1_000,     emoji: '🌱' },
  { value: 5_000,     emoji: '💡' },
  { value: 10_000,    emoji: '⭐' },
  { value: 25_000,    emoji: '🔥' },
  { value: 50_000,    emoji: '💎' },
  { value: 100_000,   emoji: '🏆' },
  { value: 250_000,   emoji: '🦁' },
  { value: 500_000,   emoji: '🚀' },
  { value: 1_000_000, emoji: '👑' },
]

interface Props { totalWealth: number }

export function Milestones({ totalWealth }: Props) {
  const { achieved, next } = useMemo(() => {
    const achieved = MILESTONES.filter(m => totalWealth >= m.value)
    const next     = MILESTONES.find(m => totalWealth < m.value) ?? null
    return { achieved, next }
  }, [totalWealth])

  const lastAchieved = achieved[achieved.length - 1] ?? null
  const progressPct  = next && lastAchieved
    ? Math.min(((totalWealth - lastAchieved.value) / (next.value - lastAchieved.value)) * 100, 100)
    : next ? Math.min((totalWealth / next.value) * 100, 100) : 100

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="trophy-outline" size={16} color={colors.accent} />
        <Text style={s.title}>Paliers patrimoniaux</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.levelBadge}>
          {lastAchieved ? `${lastAchieved.emoji} Niv. ${achieved.length}` : '—'}
        </Text>
      </View>

      {next ? (
        <>
          <View style={s.labelsRow}>
            <Text style={s.currentVal}>{formatCurrency(totalWealth)}</Text>
            <Text style={s.nextLabel}>{next.emoji} {formatCurrency(next.value)}</Text>
          </View>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={s.remaining}>
            <Text style={s.remainingValue}>{formatCurrency(next.value - totalWealth)}</Text>
            {' '}restants pour le prochain palier · {progressPct.toFixed(1)}%
          </Text>
        </>
      ) : (
        <Text style={s.completeText}>Tous les paliers atteints ! 👑</Text>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  card:       { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  title:      { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  levelBadge: { color: colors.accent, fontSize: fontSize.xs, fontWeight: '700', backgroundColor: colors.accent + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  labelsRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  currentVal: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  nextLabel:  { color: colors.textMuted, fontSize: fontSize.sm },
  barBg:      { height: 6, backgroundColor: colors.surface2, borderRadius: radius.full, overflow: 'hidden', marginBottom: 8 },
  barFill:    { height: 6, backgroundColor: colors.accent, borderRadius: radius.full },
  remaining:  { color: colors.textMuted, fontSize: fontSize.xs },
  remainingValue: { color: colors.textSecondary, fontWeight: '600' },
  completeText: { color: colors.success, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'center', paddingVertical: 8 },
})

import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'

interface Props {
  breakdown: Record<string, number>
  totalValue: number
}

interface SubScore {
  label: string
  icon: any
  score: number
  max: number
  detail: string
  color: string
}

function computeScores(breakdown: Record<string, number>, total: number): SubScore[] {
  if (total === 0) return []

  // ── 1. Diversification (0–40) ─────────────────────────────────────────────
  const nonZeroTypes = Object.values(breakdown).filter(v => v > 0).length
  const maxSinglePct = Math.max(...Object.values(breakdown)) / total
  let diversScore = 0
  diversScore += Math.min(nonZeroTypes * 6, 24) // 6 pts par catégorie, max 24
  diversScore += maxSinglePct < 0.5 ? 16 : maxSinglePct < 0.7 ? 8 : 0 
  diversScore = Math.min(diversScore, 40)

  const diversDetail =
    maxSinglePct > 0.7
      ? 'Patrimoine trop concentré'
      : nonZeroTypes < 3
      ? 'Peu de catégories d\'actifs'
      : 'Bonne répartition'

  // ── 2. Liquidité (0–30) ───────────────────────────────────────────────────
  const liquid = (breakdown.BANK_ACCOUNT ?? 0) + (breakdown.SAVINGS ?? 0)
  const liquidPct = liquid / total
  let liquidScore = 0
  if (liquidPct >= 0.05 && liquidPct <= 0.2) liquidScore = 30
  else if (liquidPct >= 0.02 && liquidPct < 0.05) liquidScore = 18
  else if (liquidPct > 0.2 && liquidPct <= 0.4) liquidScore = 20
  else if (liquidPct < 0.02) liquidScore = 5
  else liquidScore = 10 

  const liquidDetail =
    liquidPct > 0.4
      ? 'Trop de liquidités'
      : liquidPct < 0.05
      ? 'Peu de réserves liquides'
      : 'Liquidités optimales'

  // ── 3. Investissements (0–30) ─────────────────────────────────────────────
  const invested = (breakdown.STOCK ?? 0) + (breakdown.CRYPTO ?? 0) +
                   (breakdown.PEA ?? 0) + (breakdown.CTO ?? 0) +
                   (breakdown.REAL_ESTATE ?? 0)
  const investedPct = invested / total
  let investScore = 0
  if (investedPct >= 0.5) investScore = 30
  else if (investedPct >= 0.3) investScore = 20
  else if (investedPct >= 0.15) investScore = 12
  else investScore = 4

  const investDetail =
    investedPct < 0.15
      ? 'Très peu investi'
      : investedPct < 0.3
      ? 'Potentiel limité'
      : 'Bon ratio d\'investissement'

  return [
    { label: 'Diversification', icon: 'shield-checkmark', score: diversScore, max: 40, detail: diversDetail, color: colors.accent },
    { label: 'Liquidité',       icon: 'water',            score: liquidScore, max: 30, detail: liquidDetail, color: '#3B82F6' },
    { label: 'Investissements', icon: 'trending-up',      score: investScore, max: 30, detail: investDetail, color: colors.success },
  ]
}

export function HealthScore({ breakdown, totalValue }: Props) {
  const subScores = useMemo(() => computeScores(breakdown, totalValue), [breakdown, totalValue])
  const total = subScores.reduce((s, x) => s + x.score, 0)

  if (subScores.length === 0) return null

  const r = 40
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - total / 100)
  const color = total >= 70 ? colors.success : total >= 45 ? colors.warning : colors.danger

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
        <Text style={s.title}>Score de santé</Text>
      </View>

      <View style={s.content}>
        <View style={s.chartContainer}>
          <Svg width={100} height={100} viewBox="0 0 100 100">
            <Circle
              cx="50" cy="50" r={r}
              stroke={colors.surface2}
              strokeWidth="8"
              fill="none"
            />
            <Circle
              cx="50" cy="50" r={r}
              stroke={color}
              strokeWidth="8"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              fill="none"
              transform="rotate(-90 50 50)"
            />
          </Svg>
          <View style={s.scoreBox}>
            <Text style={s.scoreValue}>{total}</Text>
            <Text style={s.scoreMax}>/100</Text>
          </View>
        </View>

        <View style={s.scoresList}>
          {subScores.map(score => (
            <View key={score.label} style={s.scoreRow}>
              <View style={s.rowTop}>
                <View style={s.labelBox}>
                  <Ionicons name={score.icon as any} size={12} color={score.color} />
                  <Text style={s.rowLabel}>{score.label}</Text>
                </View>
                <Text style={s.rowValue}>{score.score}/{score.max}</Text>
              </View>
              <View style={s.barBg}>
                <View style={[s.barFill, { width: `${(score.score/score.max)*100}%`, backgroundColor: score.color }]} />
              </View>
              <Text style={s.detail}>{score.detail}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  title: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  chartContainer: { position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  scoreBox: { position: 'absolute', alignItems: 'center' },
  scoreValue: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  scoreMax: { color: colors.textMuted, fontSize: 10 },
  scoresList: { flex: 1, gap: 12 },
  scoreRow: { gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowLabel: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '500' },
  rowValue: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: '700' },
  barBg: { height: 4, backgroundColor: colors.surface2, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: 4, borderRadius: radius.full },
  detail: { color: colors.textMuted, fontSize: 10 },
})

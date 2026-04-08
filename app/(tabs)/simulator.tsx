import { useState, useMemo, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch, formatCurrency } from '@/lib/api'

// ── Calcul intérêts composés ─────────────────────────────────────────────────
// Vf = Vi × (1 + ρ/n)^(n×t) + versements périodiques
function compound(
  Vi: number,      // capital initial
  monthly: number, // versement mensuel
  rho: number,     // taux annuel en %
  t: number,       // durée en années
  n: number,       // fréquence de capitalisation par an
): Array<{ year: number; value: number; invested: number }> {
  const rate = rho / 100
  const points: Array<{ year: number; value: number; invested: number }> = []

  for (let y = 0; y <= t; y++) {
    const capitalGrowth = Vi * Math.pow(1 + rate / n, n * y)
    let versementsValue = 0
    const totalMonths = y * 12
    for (let m = 0; m < totalMonths; m++) {
      const yearsRemaining = (totalMonths - m) / 12
      versementsValue += monthly * Math.pow(1 + rate / n, n * yearsRemaining)
    }
    points.push({
      year: y,
      value:    Math.round(capitalGrowth + versementsValue),
      invested: Math.round(Vi + monthly * 12 * y),
    })
  }
  return points
}

const PRESETS = [
  { label: 'Livret A',   rate: 3,   n: 1  },
  { label: 'Fonds €',   rate: 2.5, n: 1  },
  { label: 'ETF World',  rate: 8,   n: 12 },
  { label: 'S&P 500',    rate: 10,  n: 12 },
  { label: 'Immo loc.', rate: 5,   n: 1  },
]

export default function SimulatorScreen() {
  const [Vi,      setVi]      = useState('0')
  const [monthly, setMonthly] = useState('0')
  const [rho,     setRho]     = useState(8)
  const [years,   setYears]   = useState(20)
  const [n,       setN]       = useState(12)

  const { data: stats } = useQuery<any>({ queryKey: ['dashboard'], queryFn: () => apiFetch('/api/portfolio/stats') })
  const { data: budget } = useQuery<any>({ queryKey: ['budget'], queryFn: () => apiFetch('/api/budget/items') })

  useEffect(() => {
    if (stats?.totalWealth) setVi(String(Math.round(stats.totalWealth)))
  }, [stats?.totalWealth])

  useEffect(() => {
    if (budget?.items && budget?.income) {
      const expenses = budget.items.reduce((acc: number, item: any) => acc + item.amount, 0)
      const remaining = Math.max(0, budget.income - expenses)
      if (remaining > 0) setMonthly(String(Math.round(remaining)))
    }
  }, [budget])

  const data = useMemo(
    () => compound(parseFloat(Vi) || 0, parseFloat(monthly) || 0, rho, years, n),
    [Vi, monthly, rho, years, n]
  )

  const final         = data[data.length - 1]
  const totalInvested = (parseFloat(Vi) || 0) + (parseFloat(monthly) || 0) * 12 * years
  const gains         = (final?.value ?? 0) - totalInvested
  const multiplier    = final?.value ? final.value / Math.max(totalInvested, 1) : 1

  // Compute simple SVG path for the chart (height = 160, width = proportional)
  const chartH = 140
  const chartW = 340
  const maxVal = Math.max(...data.map(d => d.value), 1)
  const toX    = (i: number) => (i / Math.max(data.length - 1, 1)) * chartW
  const toY    = (v: number) => chartH - (v / maxVal) * chartH

  const valuePath  = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`).join(' ')
  const investPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d.invested).toFixed(1)}`).join(' ')

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.pageHeader}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={s.pageTitle}>Simulateur</Text>
            <Text style={s.pageSub}>Vf = Vi × (1 + ρ/n)^(n×t)</Text>
          </View>
        </View>

        {/* ── Presets ─────────────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.md, paddingHorizontal: spacing.md }}>
          <View style={s.presetsRow}>
            {PRESETS.map(p => {
              const active = rho === p.rate && n === p.n
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[s.presetChip, active && { backgroundColor: colors.accent + '18', borderColor: colors.accent }]}
                  onPress={() => { setRho(p.rate); setN(p.n) }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: active ? colors.accent : colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' }}>
                    {p.label}
                  </Text>
                  <Text style={{ color: active ? colors.accent : colors.textMuted, fontSize: fontSize.xs }}>
                    {p.rate}%
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>

        {/* ── Paramètres ─────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.paramsGrid}>
            <View style={s.paramField}>
              <Text style={s.label}>Vi — Capital initial (€)</Text>
              <TextInput
                style={s.input}
                value={Vi}
                onChangeText={setVi}
                keyboardType="numeric"
                placeholder="10000"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={s.paramField}>
              <Text style={s.label}>Versement/mois (€)</Text>
              <TextInput
                style={s.input}
                value={monthly}
                onChangeText={setMonthly}
                keyboardType="numeric"
                placeholder="300"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {/* Sliders ρ et t */}
          <View style={{ gap: 14, marginTop: 4 }}>
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={s.label}>ρ — Taux annuel</Text>
                <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontWeight: '700' }}>{rho}%</Text>
              </View>
              <View style={s.sliderTrack}>
                {[1,2,3,4,5,6,7,8,9,10,12,15,20].map(v => (
                  <TouchableOpacity key={v} onPress={() => setRho(v)} style={[s.sliderTick, rho === v && { backgroundColor: colors.accent }]}>
                    <Text style={{ color: rho === v ? colors.background : colors.textMuted, fontSize: 8, fontWeight: '700' }}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={s.label}>t — Durée</Text>
                <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontWeight: '700' }}>{years} ans</Text>
              </View>
              <View style={s.sliderTrack}>
                {[5,10,15,20,25,30,35,40].map(v => (
                  <TouchableOpacity key={v} onPress={() => setYears(v)} style={[s.sliderTick, years === v && { backgroundColor: colors.accent }]}>
                    <Text style={{ color: years === v ? colors.background : colors.textMuted, fontSize: 8, fontWeight: '700' }}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ── Résultats ───────────────────────────────────────────────── */}
        <View style={s.resultsRow}>
          <View style={[s.resultCard, { borderColor: colors.accent + '40', backgroundColor: colors.accent + '08' }]}>
            <Text style={s.resultLabel}>Vf — Valeur finale</Text>
            <Text style={[s.resultValue, { color: colors.accent }]}>{formatCurrency(final?.value ?? 0)}</Text>
            <Text style={s.resultSub}>×{multiplier.toFixed(1)} le total investi</Text>
          </View>
          <View style={s.resultCard}>
            <Text style={s.resultLabel}>Capital investi</Text>
            <Text style={s.resultValue}>{formatCurrency(totalInvested)}</Text>
            <Text style={s.resultSub}>{formatCurrency(parseFloat(Vi) || 0)} + {monthly}€/mois</Text>
          </View>
          <View style={s.resultCard}>
            <Text style={s.resultLabel}>Intérêts composés</Text>
            <Text style={[s.resultValue, { color: colors.success }]}>+{formatCurrency(Math.max(0, gains))}</Text>
            <Text style={s.resultSub}>{totalInvested > 0 ? ((Math.max(0, gains) / totalInvested) * 100).toFixed(1) : '0'}% rendement total</Text>
          </View>
        </View>

        {/* ── Graphe SVG maison ───────────────────────────────────────── */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Ionicons name="trending-up" size={16} color={colors.accent} />
            <Text style={s.sectionTitle}>Projection sur {years} ans</Text>
          </View>

          {/* Graphe dessiné "à la main" avec des View */}
          <View style={{ height: chartH + 20, overflow: 'hidden' }}>
            {/* Y-axis labels */}
            <View style={{ position: 'absolute', left: 0, top: 0, height: chartH, justifyContent: 'space-between' }}>
              {[1, 0.75, 0.5, 0.25, 0].map(pct => (
                <Text key={pct} style={{ color: colors.textMuted, fontSize: 9 }}>
                  {`${((maxVal * pct) / 1000).toFixed(0)}k`}
                </Text>
              ))}
            </View>

            {/* Chart area */}
            <View style={{ marginLeft: 32, flex: 1 }}>
              {/* Grille horizontale */}
              {[0.25, 0.5, 0.75].map(pct => (
                <View key={pct} style={{
                  position: 'absolute',
                  top: toY(maxVal * pct),
                  left: 0, right: 0,
                  height: 1, backgroundColor: colors.border + '80',
                }} />
              ))}

              {/* Barres simplifiées pour représenter la progression */}
              <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 20)) === 0 || i === data.length - 1).map((d, i, arr) => {
                  const barH   = ((d.value / maxVal) * (chartH - 20))
                  const invH   = ((d.invested / maxVal) * (chartH - 20))
                  return (
                    <View key={d.year} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: chartH - 20 }}>
                      <View style={{ width: '100%', height: barH, backgroundColor: colors.accent + '30', borderRadius: 2 }} />
                      <View style={{ width: '100%', height: invH, backgroundColor: colors.textMuted + '40', borderRadius: 2, position: 'absolute', bottom: 0 }} />
                    </View>
                  )
                })}
              </View>

              {/* X labels */}
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
                {[0, Math.floor(years / 4), Math.floor(years / 2), Math.floor(years * 0.75), years].map(y => (
                  <Text key={y} style={{ color: colors.textMuted, fontSize: 9 }}>{y}a</Text>
                ))}
              </View>
            </View>
          </View>

          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={{ width: 12, height: 3, backgroundColor: colors.accent + '80', borderRadius: 1 }} />
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Vf (valeur)</Text>
            </View>
            <View style={s.legendItem}>
              <View style={{ width: 12, height: 3, backgroundColor: colors.textMuted + '60', borderRadius: 1 }} />
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Capital investi</Text>
            </View>
          </View>
        </View>

        {/* ── Tableau annuel ──────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={[s.sectionTitle, { marginBottom: 12 }]}>Évolution annuelle</Text>
          <View style={s.tableHeader}>
            <Text style={s.thCell}>Année</Text>
            <Text style={[s.thCell, { textAlign: 'right' }]}>Investi</Text>
            <Text style={[s.thCell, { textAlign: 'right' }]}>Valeur</Text>
            <Text style={[s.thCell, { textAlign: 'right' }]}>Gain</Text>
          </View>
          {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 10)) === 0 || i === data.length - 1).map(d => {
            const gain = d.value - d.invested
            return (
              <View key={d.year} style={s.tableRow}>
                <Text style={s.tdCell}>An {d.year}</Text>
                <Text style={[s.tdCell, { textAlign: 'right', color: colors.textMuted }]}>{(d.invested / 1000).toFixed(0)}k</Text>
                <Text style={[s.tdCell, { textAlign: 'right', fontWeight: '600' }]}>{(d.value / 1000).toFixed(0)}k€</Text>
                <Text style={[s.tdCell, { textAlign: 'right', color: gain >= 0 ? colors.success : colors.danger }]}>
                  +{(gain / 1000).toFixed(0)}k
                </Text>
              </View>
            )
          })}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  pageHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  pageTitle: { color: colors.textPrimary, fontSize: fontSize['2xl'], fontWeight: '700', letterSpacing: -0.5 },
  pageSub:   { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2, fontStyle: 'italic' },

  presetsRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  presetChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center', gap: 2,
  },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },

  paramsGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  paramField: { flex: 1 },

  label: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '500', marginBottom: 4 },
  input: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600',
  },

  sliderTrack: { flexDirection: 'row', gap: 4 },
  sliderTick: {
    flex: 1, height: 28, borderRadius: radius.sm,
    backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center',
  },

  resultsRow: { gap: spacing.sm },
  resultCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  resultLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 },
  resultValue: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700', letterSpacing: -0.5 },
  resultSub:   { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },

  legend:     { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  tableHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  tableRow:    { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  thCell: { flex: 1, color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' },
  tdCell: { flex: 1, color: colors.textPrimary, fontSize: fontSize.xs },
})

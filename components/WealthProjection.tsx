import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { formatCurrency } from '@/lib/api'

interface Props {
  currentWealth: number
  monthlyContrib?: number
  rate?: number        // annual % (default 7)
  years?: number       // default 20
}

function compound(Vi: number, monthly: number, rate: number, years: number) {
  const r = rate / 100 / 12
  const n = years * 12
  const future = Vi * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r)
  return future
}

export function WealthProjection({ currentWealth, monthlyContrib = 0, rate = 7, years = 20 }: Props) {
  const W = Dimensions.get('window').width - spacing.md * 4
  const H = 140

  const points = useMemo(() => {
    const pts: { x: number; y: number; value: number; label: string }[] = []
    const steps = [0, 5, 10, 15, 20].filter(y => y <= years)
    if (!steps.includes(years)) steps.push(years)

    const values = steps.map(y => ({
      year:  y,
      value: compound(currentWealth, monthlyContrib, rate, y),
    }))

    const maxV = Math.max(...values.map(v => v.value)) * 1.08
    const minV = Math.min(...values.map(v => v.value)) * 0.92

    return values.map((v, i) => ({
      x:     (i / (values.length - 1)) * W,
      y:     H - ((v.value - minV) / (maxV - minV || 1)) * H,
      value: v.value,
      label: v.year === 0 ? 'Auj.' : `+${v.year}a`,
    }))
  }, [currentWealth, monthlyContrib, rate, years, W])

  if (points.length < 2) return null

  const dLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const dArea = `${dLine} L${points[points.length - 1].x},${H} L0,${H} Z`
  const finalValue = points[points.length - 1].value

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={s.title}>Projection patrimoniale</Text>
        <View style={s.params}>
          <Text style={s.paramText}>{rate}%/an · {years} ans</Text>
        </View>
      </View>

      <View style={s.finalRow}>
        <View>
          <Text style={s.finalLabel}>Dans {years} ans</Text>
          <Text style={s.finalValue}>{formatCurrency(finalValue)}</Text>
        </View>
        <View style={s.multiplierBadge}>
          <Text style={s.multiplierText}>
            ×{(finalValue / (currentWealth || 1)).toFixed(1)}
          </Text>
        </View>
      </View>

      <Svg width={W} height={H + 20} style={{ marginTop: 8 }}>
        <Defs>
          <LinearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.18" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={dArea} fill="url(#projGrad)" />
        <Path d={dLine} fill="none" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <React.Fragment key={i}>
            <SvgText
              x={p.x}
              y={H + 16}
              fontSize="9"
              fill={colors.textMuted}
              textAnchor="middle"
            >
              {p.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>

      {monthlyContrib > 0 && (
        <Text style={s.contrib}>
          Versements : <Text style={{ color: colors.accent }}>{formatCurrency(monthlyContrib)}/mois</Text>
        </Text>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  card:    { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title:   { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  params:  { backgroundColor: colors.surface2, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  paramText: { color: colors.textMuted, fontSize: fontSize.xs },
  finalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  finalLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 2 },
  finalValue: { color: colors.success, fontSize: fontSize.xl, fontWeight: '700', letterSpacing: -0.5 },
  multiplierBadge: { backgroundColor: colors.success + '15', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  multiplierText:  { color: colors.success, fontWeight: '700', fontSize: fontSize.md },
  contrib: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 },
})

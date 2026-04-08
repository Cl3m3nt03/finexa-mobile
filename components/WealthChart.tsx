import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { formatCurrency } from '@/lib/api'

interface DataPoint {
  date: string
  value: number
}

interface Props {
  data: DataPoint[]
}

export function WealthChart({ data }: Props) {
  const chartWidth = Dimensions.get('window').width - spacing.md * 2 - spacing.md * 2
  const chartHeight = 180

  const { points, maxVal, minVal } = useMemo(() => {
    if (!data || data.length === 0) return { points: [], maxVal: 0, minVal: 0 }
    
    // Sort logic removed as it's assumed to be sorted or we take it as-is
    const vals = data.map(d => d.value)
    const max = Math.max(...vals) * 1.05
    const min = Math.min(...vals) * 0.95
    const range = max - min || 1

    const pts = data.map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * chartWidth
      const y = chartHeight - ((d.value - min) / range) * chartHeight
      return { x, y, value: d.value }
    })

    return { points: pts, maxVal: max, minVal: min }
  }, [data, chartWidth])

  if (points.length < 2) return (
    <View style={s.card}>
      <Text style={s.title}>Historique de patrimoine</Text>
      <View style={[s.chartArea, { justifyContent: 'center' }]}>
        <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Pas assez de données pour le graphique</Text>
      </View>
    </View>
  )

  const dPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${dPath} L${points[points.length - 1].x},${chartHeight} L0,${chartHeight} Z`

  return (
    <View style={s.card}>
      <Text style={s.title}>Historique de patrimoine</Text>
      
      <View style={s.chartArea}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.accent} stopOpacity="0.15" />
              <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          
          {/* Main Path */}
          <Path d={areaPath} fill="url(#fillGrad)" />
          <Path
            d={dPath}
            fill="none"
            stroke={colors.accent}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* End Point */}
          <Circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="4"
            fill={colors.accent}
            stroke={colors.surface}
            strokeWidth="2"
          />
        </Svg>
      </View>

      <View style={s.footer}>
        <Text style={s.label}>{data[0].date.split('-')[1]}/{data[0].date.split('-')[0]}</Text>
        <Text style={s.label}>Aujourd'hui</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  title: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600', marginBottom: 16 },
  chartArea: { height: 180, width: '100%', alignItems: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: '500' },
})

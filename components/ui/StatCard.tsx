import { View, Text } from 'react-native'
import { colors, fontSize, radius, spacing } from '@/constants/theme'

interface StatCardProps {
  label:    string
  value:    string
  sub?:     string
  subColor?: string
  accent?:  boolean
}

export function StatCard({ label, value, sub, subColor, accent }: StatCardProps) {
  return (
    <View style={{
      flex:            1,
      backgroundColor: colors.surface,
      borderRadius:    radius.lg,
      borderWidth:     1,
      borderColor:     accent ? colors.accent + '40' : colors.border,
      padding:         spacing.md,
      minWidth:        140,
    }}>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{
        color:      accent ? colors.accent : colors.textPrimary,
        fontSize:   fontSize.xl,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
      }}>
        {value}
      </Text>
      {sub && (
        <Text style={{
          color:     subColor ?? colors.textMuted,
          fontSize:  fontSize.xs,
          marginTop: 2,
        }}>
          {sub}
        </Text>
      )}
    </View>
  )
}

import { View, ViewStyle } from 'react-native'
import { colors, radius, spacing } from '@/constants/theme'

interface CardProps {
  children: React.ReactNode
  style?:   ViewStyle
}

export function Card({ children, style }: CardProps) {
  return (
    <View style={[{
      backgroundColor: colors.surface,
      borderRadius:    radius.lg,
      borderWidth:     1,
      borderColor:     colors.border,
      padding:         spacing.md,
    }, style]}>
      {children}
    </View>
  )
}

import { View, Text, ViewStyle } from 'react-native'
import { radius, fontSize } from '@/constants/theme'

interface BadgeProps {
  label:  string
  color:  string
  style?: ViewStyle
}

export function Badge({ label, color, style }: BadgeProps) {
  return (
    <View style={[{
      backgroundColor: color + '22',
      borderRadius:    radius.full,
      paddingHorizontal: 8,
      paddingVertical:   3,
    }, style]}>
      <Text style={{ color, fontSize: fontSize.xs, fontWeight: '600' }}>{label}</Text>
    </View>
  )
}

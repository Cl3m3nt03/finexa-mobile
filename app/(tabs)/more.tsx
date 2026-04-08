import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { useAuthStore } from '@/lib/store'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const MENU_ITEMS: { label: string; icon: IoniconsName; route: string; color: string; description: string }[] = [
  { label: 'Mes actifs',    icon: 'wallet-outline',         route: '/(tabs)/assets',       color: colors.accent,  description: 'Gérer vos comptes, épargne, immobilier' },
  { label: 'Budget',        icon: 'pie-chart-outline',      route: '/(tabs)/budget',       color: '#3B82F6',      description: 'Gérez vos dépenses et revenus 50/30/20' },
  { label: 'Objectifs',     icon: 'flag-outline',           route: '/(tabs)/goals',        color: '#10B981',      description: 'Atteignez vos buts financiers' },
  { label: 'Transactions',  icon: 'swap-horizontal-outline', route: '/(tabs)/transactions', color: '#F97316',     description: 'Historique de vos opérations' },
  { label: 'Simulateur',    icon: 'calculator-outline',     route: '/(tabs)/simulator',    color: '#F59E0B',      description: 'Anticipez l\'évolution de votre patrimoine' },
  { label: 'Rapport fiscal', icon: 'receipt-outline',       route: '/(tabs)/fiscal',       color: '#06B6D4',      description: 'Plus-values, PFU, guide 2042-C' },
  { label: 'Collection Pokémon', icon: 'layers-outline',    route: '/(tabs)/pokemon',      color: '#E11D48',      description: 'Suivez la valeur de votre collection' },
  { label: 'Assistant IA',  icon: 'sparkles-outline',       route: '/(tabs)/assistant',    color: '#8B5CF6',      description: 'Posez vos questions à l\'IA Financy' },
  { label: 'Paramètres',    icon: 'settings-outline',       route: '/(tabs)/settings',     color: colors.textMuted, description: 'Mot de passe, 2FA, alertes de prix' },
]

export default function MoreScreen() {
  const { user } = useAuthStore()

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Plus</Text>
        
        <TouchableOpacity style={s.profileCard} onPress={() => router.push('/profile')} activeOpacity={0.7}>
          <View style={s.profileAvatar}>
            <Text style={s.profileInitials}>{user?.name?.charAt(0) || 'U'}</Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{user?.name || 'Utilisateur'}</Text>
            <Text style={s.profileEmail}>Mon profil</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={s.menuList}>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={s.menuItem} 
              activeOpacity={0.7}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[s.iconBox, { backgroundColor: item.color + '1A' }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={s.menuText}>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Text style={s.menuDesc}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.lg },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  profileInitials: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  logoutBtn: {
    padding: spacing.sm,
  },
  menuList: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuText: {
    flex: 1,
  },
  menuLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  menuDesc: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
})

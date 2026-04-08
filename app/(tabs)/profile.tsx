import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { useAuthStore } from '@/lib/store'
import { apiFetch, formatCurrency } from '@/lib/api'

interface PortfolioStats {
  totalWealth: number
  breakdown: Record<string, number>
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore()

  const { data: stats } = useQuery<PortfolioStats>({
    queryKey: ['portfolio-stats'],
    queryFn:  () => apiFetch('/api/portfolio/stats'),
  })

  const { data: assetsData } = useQuery<{ assets: unknown[] }>({
    queryKey: ['assets'],
    queryFn:  () => apiFetch('/api/assets'),
  })

  const { data: txData } = useQuery<{ transactions: unknown[] }>({
    queryKey: ['transactions'],
    queryFn:  () => apiFetch('/api/transactions?limit=1000'),
  })

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const handleLogout = () => {
    Alert.alert('Se déconnecter', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => { logout(); router.replace('/login') } },
    ])
  }

  const totalAssets = assetsData?.assets?.length ?? 0
  const totalTx     = txData?.transactions?.length ?? 0
  const totalWealth = stats?.totalWealth ?? 0

  const statItems = [
    { label: 'Patrimoine',    value: formatCurrency(totalWealth), icon: 'wallet-outline' as const,         color: colors.accent  },
    { label: 'Actifs',        value: String(totalAssets),         icon: 'layers-outline' as const,         color: colors.purple  },
    { label: 'Transactions',  value: String(totalTx),             icon: 'swap-horizontal-outline' as const, color: colors.success },
  ]

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Profil</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + infos ──────────────────────────────────────────── */}
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarInitials}>{initials}</Text>
          </View>
          <Text style={s.name}>{user?.name ?? 'Utilisateur'}</Text>
          <Text style={s.email}>{user?.email ?? ''}</Text>
        </View>

        {/* ── Stats rapides ────────────────────────────────────────────── */}
        <View style={s.statsRow}>
          {statItems.map(item => (
            <View key={item.label} style={[s.statCard, { borderColor: item.color + '30' }]}>
              <View style={[s.statIcon, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={[s.statValue, { color: item.color }]}>{item.value}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Compte ───────────────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Compte</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
              <Text style={s.rowLabel}>Nom complet</Text>
            </View>
            <Text style={s.rowValue}>{user?.name ?? '—'}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
              <Text style={s.rowLabel}>Email</Text>
            </View>
            <Text style={s.rowValue} numberOfLines={1}>{user?.email ?? '—'}</Text>
          </View>
        </View>

        {/* ── Sécurité ─────────────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Sécurité</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.row} onPress={() => router.push('/forgot-password')}>
            <View style={s.rowLeft}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
              <Text style={s.rowLabel}>Changer le mot de passe</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.row} onPress={() => router.push('/(tabs)/settings')}>
            <View style={s.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
              <Text style={s.rowLabel}>Authentification 2FA</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Navigation</Text>
        <View style={s.card}>
          {[
            { label: 'Paramètres & Alertes', icon: 'settings-outline' as const, route: '/(tabs)/settings' },
            { label: 'Assistant IA',         icon: 'chatbubble-outline' as const, route: '/(tabs)/assistant' },
            { label: 'Simulateur',           icon: 'calculator-outline' as const, route: '/(tabs)/simulator' },
            { label: 'Collection Pokémon',   icon: 'game-controller-outline' as const, route: '/(tabs)/pokemon' },
          ].map((item, idx, arr) => (
            <View key={item.route}>
              {idx > 0 && <View style={s.divider} />}
              <TouchableOpacity style={s.row} onPress={() => router.push(item.route as any)}>
                <View style={s.rowLeft}>
                  <Ionicons name={item.icon} size={18} color={colors.textSecondary} />
                  <Text style={s.rowLabel}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* ── Déconnexion ───────────────────────────────────────────────── */}
        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={s.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={s.version}>Finexa v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary },
  scroll:  { padding: spacing.md, gap: spacing.lg, paddingBottom: 48 },

  avatarSection: { alignItems: 'center', paddingVertical: spacing.md },
  avatar:         {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  avatarInitials: { color: colors.background, fontSize: 30, fontWeight: '800' },
  name:   { fontSize: fontSize.xl,  fontWeight: '700', color: colors.textPrimary },
  email:  { fontSize: fontSize.sm,  color: colors.textMuted, marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, padding: 12, alignItems: 'center', gap: 6,
  },
  statIcon:  { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: fontSize.md, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontSize: fontSize.xs, color: colors.textMuted },

  sectionTitle: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  card:         { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  rowLeft:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel:     { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '500' },
  rowValue:     { color: colors.textMuted, fontSize: fontSize.sm, maxWidth: 160 },
  divider:      { height: 1, backgroundColor: colors.border, marginLeft: spacing.md + 18 + 10 },

  logoutBtn:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.danger + '10', paddingVertical: spacing.md,
    borderRadius: radius.xl, borderWidth: 1, borderColor: colors.danger + '30',
  },
  logoutText: { color: colors.danger, fontSize: fontSize.md, fontWeight: '600' },
  version:    { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', marginTop: -8 },
})

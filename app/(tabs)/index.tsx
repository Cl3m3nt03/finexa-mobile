import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch, formatCurrency } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { HealthScore } from '@/components/HealthScore'
import { Milestones } from '@/components/Milestones'
import { WealthChart } from '@/components/WealthChart'
import { WealthProjection } from '@/components/WealthProjection'
import { WealthFlow } from '@/components/WealthFlow'
import { PassiveIncome } from '@/components/PassiveIncome'

interface DashboardStats {
  // portfolio/stats API fields
  totalValue?:       number
  totalWealth?:      number
  totalPnl?:         number
  totalPnlPercent?:  number
  monthlyChange?:    number
  monthlyPct?:       number
  history: { date: string; value: number }[]
  breakdown: {
    BANK_ACCOUNT?: number
    SAVINGS?:      number
    REAL_ESTATE?:  number
    STOCK?:        number
    CRYPTO?:       number
    PEA?:          number
    CTO?:          number
    OTHER?:        number
  }
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const TYPE_LABELS: Record<string, { label: string; color: string; icon: IoniconsName }> = {
  BANK_ACCOUNT: { label: 'Comptes',     color: colors.accent,  icon: 'card-outline'         },
  SAVINGS:      { label: 'Épargne',     color: '#06B6D4',      icon: 'shield-checkmark-outline' },
  REAL_ESTATE:  { label: 'Immobilier',  color: '#F97316',      icon: 'home-outline'          },
  STOCK:        { label: 'Bourse',      color: '#3B82F6',      icon: 'bar-chart-outline'     },
  CRYPTO:       { label: 'Crypto',      color: '#8B5CF6',      icon: 'logo-bitcoin'          },
  PEA:          { label: 'PEA',         color: colors.accent,  icon: 'trending-up-outline'   },
  CTO:          { label: 'CTO',         color: '#A78BFA',      icon: 'stats-chart-outline'   },
  OTHER:        { label: 'Autre',       color: colors.textMuted, icon: 'ellipsis-horizontal-outline' },
}

const QUICK_ACTIONS: { label: string; icon: IoniconsName; route: any }[] = [
  { label: 'Portfolio',    icon: 'trending-up-outline',    route: '/(tabs)/portfolio'    },
  { label: 'Budget',       icon: 'pie-chart-outline',      route: '/(tabs)/budget'       },
  { label: 'Transactions', icon: 'swap-horizontal-outline', route: '/(tabs)/transactions' },
  { label: 'Goals',        icon: 'target-outline',         route: '/(tabs)/goals'        },
]

export default function DashboardScreen() {
  const { user } = useAuthStore()

  const { data, isLoading, refetch, isRefetching } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn:  () => apiFetch('/api/portfolio/stats'),
  })

  const { data: budgetData } = useQuery<{ items: { label: string; amount: number; category: 'needs'|'wants'|'savings' }[]; income: number | null }>({
    queryKey: ['budget'],
    queryFn:  () => apiFetch('/api/budget/items'),
  })

  // API returns totalValue (portfolio/stats) — support both field names
  const totalWealth  = data?.totalWealth  ?? data?.totalValue     ?? 0
  const monthlyPnl   = data?.monthlyChange ?? data?.totalPnl      ?? 0
  const monthlyPct   = data?.monthlyPct   ?? data?.totalPnlPercent ?? 0

  const changeColor = monthlyPnl >= 0 ? colors.success : colors.danger
  const sign        = monthlyPnl >= 0 ? '+' : ''

  const breakdownEntries = Object.entries(data?.breakdown ?? {})
    .filter(([, v]) => (v ?? 0) > 0)
    .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))

  const total = totalWealth

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>
              Bonjour{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </Text>
            <Text style={s.subtitle}>Ravi de vous revoir !</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profile' as any)} style={s.profileBtn} activeOpacity={0.7}>
            <Ionicons name="person-circle-outline" size={28} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Hero patrimoine ─────────────────────────────────────────── */}
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>Patrimoine total</Text>
          {isLoading
            ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
            : (
              <>
                <Text style={s.heroValue}>{formatCurrency(total)}</Text>
                {data && (
                  <View style={s.heroChange}>
                    <View style={[s.changeBadge, { backgroundColor: changeColor + '18' }]}>
                      <Text style={{ color: changeColor, fontSize: fontSize.sm, fontWeight: '600' }}>
                        {sign}{formatCurrency(monthlyPnl)} ({sign}{monthlyPct.toFixed(2)}%)
                      </Text>
                    </View>
                    <Text style={s.changeSub}>ce mois</Text>
                  </View>
                )}
              </>
            )
          }
        </View>

        {data && data.history && data.history.length > 0 && (
          <WealthChart data={data.history} />
        )}

        {data && (
          <View style={{ gap: spacing.md }}>
            <HealthScore breakdown={data.breakdown} totalValue={total} />
            <Milestones totalWealth={total} />
            <WealthProjection
              currentWealth={total}
              monthlyContrib={budgetData?.items?.filter(i => i.category === 'investment').reduce((s, i) => s + i.amount, 0) ?? 0}
            />
            <PassiveIncome />
            {budgetData && budgetData.income ? (
              <WealthFlow
                income={budgetData.income}
                items={budgetData.items ?? []}
                totalWealth={total}
              />
            ) : null}
          </View>
        )}

        {/* ── Quick stats ─────────────────────────────────────────────── */}
        {data && (
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>PEA + CTO + Bourse</Text>
              <Text style={s.statValue}>
                {formatCurrency((data.breakdown.PEA ?? 0) + (data.breakdown.CTO ?? 0) + (data.breakdown.STOCK ?? 0))}
              </Text>
              <Text style={s.statSub}>Marchés financiers</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Épargne</Text>
              <Text style={s.statValue}>{formatCurrency(data.breakdown.SAVINGS ?? 0)}</Text>
              <Text style={s.statSub}>Livrets & fonds</Text>
            </View>
          </View>
        )}

        {/* ── Répartition ─────────────────────────────────────────────── */}
        {breakdownEntries.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Répartition</Text>
            <View style={{ gap: 14, marginTop: 14 }}>
              {breakdownEntries.map(([type, value]) => {
                const cfg = TYPE_LABELS[type] ?? { label: type, color: colors.textMuted, icon: 'ellipsis-horizontal-outline' as IoniconsName }
                const pct = total > 0 ? (value / total) * 100 : 0
                return (
                  <View key={type}>
                    <View style={s.breakdownRow}>
                      <View style={[s.breakdownIcon, { backgroundColor: cfg.color + '18' }]}>
                        <Ionicons name={cfg.icon} size={13} color={cfg.color} />
                      </View>
                      <Text style={s.breakdownLabel}>{cfg.label}</Text>
                      <Text style={s.breakdownPct}>{pct.toFixed(1)}%</Text>
                      <Text style={s.breakdownValue}>{formatCurrency(value)}</Text>
                    </View>
                    <View style={s.barBg}>
                      <View style={[s.barFill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: cfg.color }]} />
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}

        {/* ── Accès rapides ───────────────────────────────────────────── */}
        <View style={s.actionsGrid}>
          {QUICK_ACTIONS.map(a => (
            <TouchableOpacity
              key={a.route}
              style={s.actionBtn}
              onPress={() => router.push(a.route as any)}
              activeOpacity={0.7}
            >
              <View style={s.actionIconWrap}>
                <Ionicons name={a.icon} size={20} color={colors.accent} />
              </View>
              <Text style={s.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 32 },

  // Header
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   4,
  },
  greeting: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { color: colors.textMuted,   fontSize: fontSize.sm, marginTop: 2 },
  profileBtn: {
    padding:         4,
    borderRadius:    radius.full,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Hero card
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.lg,
    alignItems:      'center',
  },
  heroLabel: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: 6, letterSpacing: 0.5 },
  heroValue: {
    color:      colors.textPrimary,
    fontSize:   38,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  heroChange: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  changeBadge: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'transparent' },
  changeSub: { color: colors.textMuted, fontSize: fontSize.xs },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex:            1,
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
  },
  statLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 },
  statValue: { color: colors.accent,    fontSize: fontSize.lg, fontWeight: '700', letterSpacing: -0.5 },
  statSub:   { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },

  // Breakdown card
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },

  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  breakdownIcon: {
    width: 26, height: 26, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  breakdownLabel: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm },
  breakdownPct:   { color: colors.textMuted, fontSize: fontSize.xs, width: 38, textAlign: 'right' },
  breakdownValue: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600', width: 95, textAlign: 'right' },
  barBg:   { height: 3, backgroundColor: colors.surface2, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: radius.full },

  // Quick actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionBtn: {
    flex:            1,
    minWidth:        '45%' as any,
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
    alignItems:      'center',
    gap:             8,
  },
  actionIconWrap: {
    width:           40,
    height:          40,
    borderRadius:    radius.md,
    backgroundColor: colors.accent + '12',
    alignItems:      'center',
    justifyContent:  'center',
  },
  actionLabel: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '500' },
})

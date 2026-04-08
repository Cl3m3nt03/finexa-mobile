import { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, Animated, ActivityIndicator, TouchableOpacity, Modal, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch, formatCurrency, formatPercent } from '@/lib/api'
import Svg, { Circle, G, Path, Line, Text as SvgText } from 'react-native-svg'

interface Holding {
  id:          string
  symbol:      string
  name:        string
  quantity:    number
  avgBuyPrice: number
  currency:    string
  currentPrice?: number
  change24h?:    number
}

interface Asset {
  id:       string
  name:     string
  type:     string
  value:    number
  currency: string
  holdings: Holding[]
}

interface PriceData {
  symbol:       string
  price:        number
  change24h:    number
  changePct24h: number
}

interface DividendTx {
  id:      string
  symbol:  string | null
  price:   number
  date:    string
  holding: { symbol: string; name: string } | null
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const TYPE_ICONS: Record<string, { color: string; icon: IoniconsName }> = {
  STOCK:  { color: '#3B82F6', icon: 'bar-chart-outline'   },
  CRYPTO: { color: '#8B5CF6', icon: 'logo-bitcoin'        },
  PEA:    { color: colors.accent, icon: 'trending-up-outline' },
  CTO:    { color: '#A78BFA', icon: 'stats-chart-outline' },
}

function PnlRow({ holding, price, onPress }: { holding: Holding; price?: PriceData; onPress?: () => void }) {
  const currentPrice = price?.price ?? holding.avgBuyPrice
  const invested     = holding.avgBuyPrice * holding.quantity
  const current      = currentPrice * holding.quantity
  const pnl          = current - invested
  const pnlPct       = invested > 0 ? (pnl / invested) * 100 : 0
  const isPos        = pnl >= 0

  const flashAnim = useRef(new Animated.Value(0)).current
  const prevPrice = useRef<number>(currentPrice)

  useEffect(() => {
    if (price?.price && price.price !== prevPrice.current) {
      prevPrice.current = price.price
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]).start()
    }
  }, [price?.price])

  const flashColor = flashAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['transparent', isPos ? colors.success + '20' : colors.danger + '20'],
  })

  const cfg = TYPE_ICONS[holding.symbol?.includes('.') ? 'STOCK' : 'CRYPTO'] ?? { color: colors.accent, icon: 'trending-up-outline' as IoniconsName }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
    <Animated.View style={[s.holdingRow, { backgroundColor: flashColor }]}>
      <View style={s.holdingLeft}>
        <View style={[s.symbolBadge, { backgroundColor: cfg.color + '18' }]}>
          <Text style={[s.symbolText, { color: cfg.color }]}>
            {holding.symbol.replace(/\.[A-Z]+$/, '').slice(0, 4)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.holdingName} numberOfLines={1}>{holding.name}</Text>
          <Text style={s.holdingSymbol}>{holding.symbol} · {holding.quantity} part{holding.quantity > 1 ? 's' : ''}</Text>
        </View>
      </View>

      <View style={s.holdingRight}>
        <Text style={s.holdingValue}>{formatCurrency(current, holding.currency)}</Text>
        <View style={[s.pnlBadge, { backgroundColor: isPos ? colors.success + '18' : colors.danger + '18' }]}>
          <Text style={{ color: isPos ? colors.success : colors.danger, fontSize: fontSize.xs, fontWeight: '600' }}>
            {isPos ? '+' : ''}{pnlPct.toFixed(1)}%
          </Text>
        </View>
        {price && (
          <Text style={s.priceText}>
            {formatCurrency(price.price, holding.currency)}
            {' '}
            <Text style={{ color: price.change24h >= 0 ? colors.success : colors.danger }}>
              {formatPercent(price.changePct24h)}
            </Text>
          </Text>
        )}
      </View>
    </Animated.View>
    </TouchableOpacity>
  )
}

// ── Couleurs des lignes du graphe comparatif ────────────────────────────────
const LINE_COLORS = ['#C9A84C', '#3B82F6', '#10B981', '#8B5CF6']

interface CompareSeries {
  label: string
  data:  { date: string; value: number }[]
}

function HoldingDetailSheet({
  holding, price, invested, onClose,
}: {
  holding:  Holding
  price?:   { price: number; changePct24h: number }
  invested: number
  onClose:  () => void
}) {
  const currentPrice  = price?.price ?? holding.avgBuyPrice
  const currentValue  = currentPrice * holding.quantity
  const pnl           = currentValue - invested
  const pnlPct        = invested > 0 ? (pnl / invested) * 100 : 0
  const isPos         = pnl >= 0

  // Fetch compare data — since first purchase (approximated from avgBuyPrice date, use 1y ago as fallback)
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: compareData, isLoading } = useQuery<Record<string, CompareSeries>>({
    queryKey: ['compare', holding.symbol, invested],
    queryFn:  () => apiFetch(
      `/api/performance/compare?symbol=${encodeURIComponent(holding.symbol)}&since=${since}&amount=${invested.toFixed(2)}`
    ),
    staleTime: 5 * 60 * 1000,
  })

  const W   = Dimensions.get('window').width - spacing.md * 4
  const H   = 160
  const entries = Object.entries(compareData ?? {})

  // Build SVG paths
  const allValues = entries.flatMap(([, s]) => s.data.map(d => d.value))
  const maxV = Math.max(...allValues, invested * 1.1) * 1.02
  const minV = Math.min(...allValues, invested * 0.9) * 0.98
  const range = maxV - minV || 1
  const maxLen = Math.max(...entries.map(([, s]) => s.data.length), 1)

  const toX = (i: number, len: number) => (i / Math.max(len - 1, 1)) * W
  const toY = (v: number) => H - ((v - minV) / range) * H

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View style={ds.sheet}>
          <View style={ds.handle} />

          {/* Header */}
          <View style={ds.header}>
            <View style={{ flex: 1 }}>
              <Text style={ds.symbol}>{holding.symbol}</Text>
              <Text style={ds.name} numberOfLines={1}>{holding.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={ds.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={ds.statsRow}>
            <View style={ds.stat}>
              <Text style={ds.statLabel}>Valeur actuelle</Text>
              <Text style={ds.statValue}>{formatCurrency(currentValue)}</Text>
            </View>
            <View style={ds.stat}>
              <Text style={ds.statLabel}>Investi</Text>
              <Text style={ds.statValue}>{formatCurrency(invested)}</Text>
            </View>
            <View style={ds.stat}>
              <Text style={ds.statLabel}>P&L</Text>
              <Text style={[ds.statValue, { color: isPos ? colors.success : colors.danger }]}>
                {isPos ? '+' : ''}{formatCurrency(pnl)}
              </Text>
            </View>
            <View style={ds.stat}>
              <Text style={ds.statLabel}>Perf</Text>
              <Text style={[ds.statValue, { color: isPos ? colors.success : colors.danger }]}>
                {isPos ? '+' : ''}{pnlPct.toFixed(2)}%
              </Text>
            </View>
          </View>

          {/* Chart */}
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 8 }}>
              Performance comparée — même montant investi · 12 mois
            </Text>

            {isLoading ? (
              <ActivityIndicator color={colors.accent} style={{ height: H }} />
            ) : entries.length === 0 ? (
              <View style={{ height: H, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Données indisponibles</Text>
              </View>
            ) : (
              <Svg width={W} height={H + 20}>
                {/* Baseline (invested amount) */}
                <Line
                  x1={0} y1={toY(invested)} x2={W} y2={toY(invested)}
                  stroke={colors.border} strokeWidth="1" strokeDasharray="4,4"
                />
                {/* Curves */}
                {entries.map(([sym, series], idx) => {
                  const d = series.data
                    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i, d?.length ?? 1).toFixed(1)},${toY(p.value).toFixed(1)}`)
                    .join(' ')
                  return (
                    <Path
                      key={sym}
                      d={d}
                      fill="none"
                      stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                      strokeWidth={idx === 0 ? 2.5 : 1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={idx === 0 ? 1 : 0.7}
                    />
                  )
                })}
                {/* X labels */}
                {entries[0]?.data.filter((_, i, arr) =>
                  i === 0 || i === Math.floor(arr.length / 2) || i === arr.length - 1
                ).map((p, i, arr) => (
                  <SvgText
                    key={i}
                    x={i === 0 ? 0 : i === 1 ? W / 2 : W}
                    y={H + 14}
                    fontSize="9"
                    fill={colors.textMuted}
                    textAnchor={i === 0 ? 'start' : i === 1 ? 'middle' : 'end'}
                  >
                    {new Date(p.date).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}
                  </SvgText>
                ))}
              </Svg>
            )}
          </View>

          {/* Légende */}
          {entries.length > 0 && (
            <View style={ds.legend}>
              {entries.map(([sym, series], idx) => {
                const last    = series.data[series.data.length - 1]?.value ?? invested
                const perfPct = ((last - invested) / invested) * 100
                const pos     = perfPct >= 0
                return (
                  <View key={sym} style={ds.legendItem}>
                    <View style={[ds.legendDot, { backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }]} />
                    <Text style={ds.legendLabel}>{series.label}</Text>
                    <Text style={[ds.legendPerf, { color: pos ? colors.success : colors.danger }]}>
                      {pos ? '+' : ''}{perfPct.toFixed(1)}%
                    </Text>
                    <Text style={ds.legendValue}>{formatCurrency(last)}</Text>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

export default function PortfolioScreen() {
  const [activeTab, setActiveTab]       = useState<'positions' | 'sectors' | 'dividends'>('positions')
  const [selectedHolding, setSelected]  = useState<{ holding: Holding; invested: number } | null>(null)
  const { data: assets, isLoading, refetch, isRefetching } = useQuery<Asset[]>({
    queryKey:        ['assets'],
    queryFn:         () => apiFetch('/api/assets'),
    refetchInterval: 30_000,
  })

  const symbols = (assets ?? [])
    .flatMap(a => a.holdings.map(h => h.symbol))
    .filter(Boolean)

  const { data: dividends } = useQuery<DividendTx[]>({
    queryKey: ['dividends'],
    queryFn:  () => apiFetch('/api/transactions?type=DIVIDEND&limit=200'),
  })

  const { data: prices, refetch: refetchPrices } = useQuery<PriceData[]>({
    queryKey:        ['prices', symbols.join(',')],
    queryFn:         () => apiFetch(`/api/prices?symbols=${symbols.join(',')}`),
    enabled:         symbols.length > 0,
    refetchInterval: 10_000,
  })

  const priceMap = Object.fromEntries((prices ?? []).map(p => [p.symbol, p]))

  const financialAssets = (assets ?? []).filter(a =>
    ['STOCK', 'CRYPTO', 'PEA', 'CTO'].includes(a.type) && a.holdings.length > 0
  )
  const otherAssets = (assets ?? []).filter(a =>
    !['STOCK', 'CRYPTO', 'PEA', 'CTO'].includes(a.type)
  )

  const { totalInvested, totalCurrent } = financialAssets.reduce((acc, asset) => {
    for (const h of asset.holdings) {
      const price = priceMap[h.symbol]?.price ?? h.avgBuyPrice
      acc.totalInvested += h.avgBuyPrice * h.quantity
      acc.totalCurrent  += price * h.quantity
    }
    return acc
  }, { totalInvested: 0, totalCurrent: 0 })

  const totalPnl    = totalCurrent - totalInvested
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
  const isPos       = totalPnl >= 0

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { refetch(); refetchPrices() }}
            tintColor={colors.accent}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>Portfolio</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {prices && (
              <View style={s.liveChip}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>Live</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => router.push('/portfolio/add' as any)} style={s.addBtn}>
              <Ionicons name="add" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tabs ───────────────────────────────────────────────────── */}
        <View style={s.tabBar}>
          {(['positions', 'sectors', 'dividends'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.tabItem, activeTab === tab && s.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabLabel, activeTab === tab && s.tabLabelActive]}>
                {tab === 'positions' ? 'Positions' : tab === 'sectors' ? 'Secteurs' : 'Dividendes'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

        {activeTab === 'positions' && (
          <>
            {/* ── P&L global ─────────────────────────────────────────────── */}
            {financialAssets.length > 0 && (
              <View style={s.heroCard}>
                <Text style={s.heroLabel}>Valeur totale investie</Text>
                <Text style={s.heroValue}>{formatCurrency(totalCurrent)}</Text>
                <View style={[s.pnlBadge, {
                  backgroundColor: isPos ? colors.success + '18' : colors.danger + '18',
                  borderColor:     isPos ? colors.success + '30' : colors.danger + '30',
                  marginTop: 10,
                }]}>
                  <Text style={{ color: isPos ? colors.success : colors.danger, fontWeight: '700', fontSize: fontSize.sm }}>
                    {isPos ? '+' : ''}{formatCurrency(totalPnl)} ({totalPnlPct.toFixed(2)}%)
                  </Text>
                </View>
                <Text style={s.updateNote}>
                  <Ionicons name="refresh-outline" size={10} color={colors.textMuted} /> Mis à jour toutes les 10s
                </Text>
              </View>
            )}

            {/* ── Positions financières ───────────────────────────────────── */}
            {financialAssets.map(asset => {
              const cfg = TYPE_ICONS[asset.type] ?? { color: colors.accent, icon: 'trending-up-outline' as IoniconsName }
              return (
                <View key={asset.id} style={s.card}>
                  <View style={s.assetHeader}>
                    <View style={[s.assetIconWrap, { backgroundColor: cfg.color + '15' }]}>
                      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                    </View>
                    <Text style={s.assetName}>{asset.name}</Text>
                    <View style={[s.typeBadge, { backgroundColor: cfg.color + '18' }]}>
                      <Text style={{ color: cfg.color, fontSize: fontSize.xs, fontWeight: '600' }}>{asset.type}</Text>
                    </View>
                  </View>
                  <View style={{ gap: 1, marginTop: 10 }}>
                    {asset.holdings.map(h => (
                      <PnlRow
                        key={h.id}
                        holding={h}
                        price={priceMap[h.symbol]}
                        onPress={() => setSelected({ holding: h, invested: h.avgBuyPrice * h.quantity })}
                      />
                    ))}
                  </View>
                </View>
              )
            })}

            {/* ── Autres actifs ───────────────────────────────────────────── */}
            {otherAssets.length > 0 && (
              <View style={s.card}>
                <Text style={s.sectionTitle}>Autres actifs</Text>
                <View style={{ gap: 10, marginTop: 12 }}>
                  {otherAssets.map(asset => (
                    <View key={asset.id} style={s.otherRow}>
                      <Text style={s.otherName}>{asset.name}</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.otherValue}>{formatCurrency(asset.value, asset.currency)}</Text>
                        <Text style={s.otherType}>{asset.type}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {activeTab === 'sectors' && (() => {
          const totalVal = assets?.reduce((acc, a) => acc + a.value, 0) ?? 0
          const slices = Object.entries(TYPE_ICONS).map(([type, cfg]) => ({
            type, cfg,
            value: assets?.filter(a => a.type === type).reduce((acc, a) => acc + a.value, 0) ?? 0,
          })).filter(s => s.value > 0)

          // SVG donut
          const R = 70, r = 44, cx = 90, cy = 90, size = 180
          let angle = -Math.PI / 2
          const paths = slices.map(sl => {
            const pct   = sl.value / Math.max(totalVal, 1)
            const sweep = pct * 2 * Math.PI
            const x1    = cx + R * Math.cos(angle)
            const y1    = cy + R * Math.sin(angle)
            angle      += sweep
            const x2    = cx + R * Math.cos(angle)
            const y2    = cy + R * Math.sin(angle)
            const xi1   = cx + r * Math.cos(angle)
            const yi1   = cy + r * Math.sin(angle)
            angle      -= sweep
            const xi2   = cx + r * Math.cos(angle)
            const yi2   = cy + r * Math.sin(angle)
            angle      += sweep
            const large = sweep > Math.PI ? 1 : 0
            const d     = `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} L${xi1.toFixed(2)},${yi1.toFixed(2)} A${r},${r} 0 ${large},0 ${xi2.toFixed(2)},${yi2.toFixed(2)} Z`
            return { ...sl, d, pct }
          })

          const TYPE_LABELS_MAP: Record<string, string> = {
            STOCK: 'Bourse', CRYPTO: 'Crypto', PEA: 'PEA', CTO: 'CTO',
            REAL_ESTATE: 'Immobilier', SAVINGS: 'Épargne', BANK_ACCOUNT: 'Compte', OTHER: 'Autre',
          }

          return (
            <View style={s.card}>
              <Text style={s.sectionTitle}>Répartition du patrimoine</Text>

              {/* Donut */}
              <View style={{ alignItems: 'center', marginVertical: 12 }}>
                <Svg width={size} height={size}>
                  <G>
                    {paths.map((p, i) => (
                      <Path key={i} d={p.d} fill={p.cfg.color} opacity={0.9} />
                    ))}
                    <Circle cx={cx} cy={cy} r={r - 2} fill={colors.surface} />
                  </G>
                </Svg>
                <View style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.md }}>{formatCurrency(totalVal)}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>patrimoine</Text>
                </View>
              </View>

              {/* Légende */}
              <View style={{ gap: 10 }}>
                {paths.map(p => (
                  <View key={p.type}>
                    <View style={s.breakdownRow}>
                      <View style={[s.assetIconWrap, { backgroundColor: p.cfg.color + '15' }]}>
                        <Ionicons name={p.cfg.icon} size={12} color={p.cfg.color} />
                      </View>
                      <Text style={s.breakdownLabel}>{TYPE_LABELS_MAP[p.type] ?? p.type}</Text>
                      <Text style={s.breakdownPct}>{(p.pct * 100).toFixed(1)}%</Text>
                      <Text style={s.breakdownValue}>{formatCurrency(p.value)}</Text>
                    </View>
                    <View style={s.barBg}>
                      <View style={[s.barFill, { width: `${p.pct * 100}%`, backgroundColor: p.cfg.color }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )
        })()}

        {activeTab === 'dividends' && (() => {
          const oneYearAgo  = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
          const last12m     = (dividends ?? []).filter(t => new Date(t.date) >= oneYearAgo)
          const totalAnnual = last12m.reduce((s, t) => s + t.price, 0)
          const monthlyAvg  = totalAnnual / 12
          const bySymbol    = last12m.reduce((acc, t) => {
            const key = t.symbol ?? t.holding?.symbol ?? 'Autre'
            acc[key]  = (acc[key] ?? 0) + t.price
            return acc
          }, {} as Record<string, number>)
          const bySymbolSorted = Object.entries(bySymbol).sort(([,a],[,b]) => b - a)

          if ((dividends ?? []).length === 0) return (
            <View style={[s.card, { alignItems: 'center', paddingVertical: 40 }]}>
              <Ionicons name="cash-outline" size={40} color={colors.textMuted} style={{ marginBottom: 12 }} />
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.md, fontWeight: '600' }}>Aucun dividende</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, textAlign: 'center' }}>
                Ajoutez vos encaissements via l'onglet Transactions.
              </Text>
            </View>
          )

          return (
            <>
              {/* Hero revenus passifs */}
              <View style={s.heroCard}>
                <Text style={s.heroLabel}>Revenus passifs (12 mois)</Text>
                <Text style={[s.heroValue, { color: colors.success }]}>{formatCurrency(totalAnnual)}</Text>
                <View style={{ flexDirection: 'row', gap: 24, marginTop: 12 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Mensuel moy.</Text>
                    <Text style={{ color: colors.success, fontWeight: '700', fontSize: fontSize.md }}>{formatCurrency(monthlyAvg)}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Versements</Text>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.md }}>{last12m.length}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Quotidien moy.</Text>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.md }}>{formatCurrency(totalAnnual / 365)}</Text>
                  </View>
                </View>
              </View>

              {/* Par symbole */}
              {bySymbolSorted.length > 0 && (
                <View style={s.card}>
                  <Text style={s.sectionTitle}>Par actif — 12 derniers mois</Text>
                  <View style={{ gap: 10, marginTop: 14 }}>
                    {bySymbolSorted.map(([sym, amt]) => {
                      const pct = totalAnnual > 0 ? (amt / totalAnnual) * 100 : 0
                      return (
                        <View key={sym}>
                          <View style={s.breakdownRow}>
                            <View style={[s.assetIconWrap, { backgroundColor: colors.success + '15' }]}>
                              <Ionicons name="cash-outline" size={12} color={colors.success} />
                            </View>
                            <Text style={s.breakdownLabel}>{sym}</Text>
                            <Text style={s.breakdownPct}>{pct.toFixed(1)}%</Text>
                            <Text style={[s.breakdownValue, { color: colors.success }]}>{formatCurrency(amt)}</Text>
                          </View>
                          <View style={s.barBg}>
                            <View style={[s.barFill, { width: `${pct}%`, backgroundColor: colors.success }]} />
                          </View>
                        </View>
                      )
                    })}
                  </View>
                </View>
              )}

              {/* Dernières transactions */}
              <View style={s.card}>
                <Text style={s.sectionTitle}>Historique</Text>
                <View style={{ gap: 2, marginTop: 12 }}>
                  {(dividends ?? []).slice(0, 20).map(t => (
                    <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <View style={[s.assetIconWrap, { backgroundColor: colors.success + '15' }]}>
                        <Ionicons name="arrow-down-outline" size={12} color={colors.success} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '500' }}>
                          {t.symbol ?? t.holding?.symbol ?? 'Dividende'}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                          {new Date(t.date).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                      <Text style={{ color: colors.success, fontWeight: '600', fontSize: fontSize.sm }}>
                        +{formatCurrency(t.price)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )
        })()}

        {!isLoading && (assets ?? []).length === 0 && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 48 }]}>
            <Ionicons name="bar-chart-outline" size={40} color={colors.textMuted} style={{ marginBottom: 12 }} />
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.md, fontWeight: '600' }}>
              Aucun actif
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, textAlign: 'center' }}>
              Commencez à suivre votre patrimoine en ajoutant un actif.
            </Text>
            <TouchableOpacity 
              onPress={() => router.push('/portfolio/add' as any)}
              style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: colors.accent, borderRadius: radius.full }}
            >
              <Text style={{ color: colors.background, fontWeight: '600' }}>Ajouter un actif</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {selectedHolding && (
        <HoldingDetailSheet
          holding={selectedHolding.holding}
          price={priceMap[selectedHolding.holding.symbol]}
          invested={selectedHolding.invested}
          onClose={() => setSelected(null)}
        />
      )}
    </SafeAreaView>
  )
}

// ── Styles du detail sheet ───────────────────────────────────────────────────
const ds = StyleSheet.create({
  sheet:     { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: 40 },
  handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  header:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  symbol:    { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700', letterSpacing: -0.5 },
  name:      { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  closeBtn:  { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  statsRow:  { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.lg, padding: 12, gap: 4, marginBottom: 4 },
  stat:      { flex: 1, alignItems: 'center' },
  statLabel: { color: colors.textMuted, fontSize: 10, marginBottom: 3 },
  statValue: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' },
  legend:    { gap: 8, marginTop: 12 },
  legendItem:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel:{ flex: 1, color: colors.textSecondary, fontSize: fontSize.xs },
  legendPerf: { fontSize: fontSize.xs, fontWeight: '700', minWidth: 48, textAlign: 'right' },
  legendValue:{ color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: '600', minWidth: 72, textAlign: 'right' },
})

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 32 },

  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pageTitle:  { color: colors.textPrimary, fontSize: fontSize['2xl'], fontWeight: '700', letterSpacing: -0.5 },
  addBtn:     { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },

  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.success + '18', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  liveDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  liveText: { color: colors.success, fontSize: fontSize.xs, fontWeight: '600' },

  heroCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, alignItems: 'center',
  },
  heroLabel: { color: colors.textMuted,    fontSize: fontSize.xs,    marginBottom: 6, letterSpacing: 0.5 },
  heroValue: { color: colors.textPrimary,  fontSize: 32,             fontWeight: '700', letterSpacing: -1 },
  updateNote: { color: colors.textMuted,   fontSize: fontSize.xs,    marginTop: 8 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },

  assetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  assetIconWrap: { width: 28, height: 28, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  assetName: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  typeBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },

  holdingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.md },
  holdingLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  holdingRight: { alignItems: 'flex-end', gap: 3 },

  symbolBadge: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  symbolText:  { fontSize: 10, fontWeight: '700' },

  holdingName:   { color: colors.textPrimary,   fontSize: fontSize.sm, fontWeight: '500', maxWidth: 130 },
  holdingSymbol: { color: colors.textMuted,      fontSize: fontSize.xs },
  holdingValue:  { color: colors.textPrimary,    fontSize: fontSize.sm, fontWeight: '600' },
  priceText:     { color: colors.textMuted,      fontSize: fontSize.xs },

  pnlBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },

  sectionTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  otherRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  otherName:  { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm },
  otherValue: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  otherType:  { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 },

  tabBar: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.md, padding: 4, marginBottom: 10 },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.surface },
  tabLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' },
  tabLabelActive: { color: colors.accent },

  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  breakdownLabel: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm },
  breakdownPct:   { color: colors.textMuted, fontSize: fontSize.xs, width: 38, textAlign: 'right' },
  breakdownValue: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600', width: 95, textAlign: 'right' },
  barBg:   { height: 3, backgroundColor: colors.surface2, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: radius.full },
})

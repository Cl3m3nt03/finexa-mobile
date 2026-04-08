import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch, formatCurrency } from '@/lib/api'

interface FiscalLine {
  date:        string
  symbol:      string
  quantity:    number
  sellPrice:   number
  avgBuyPrice: number
  plusValue:   number
  accountType: string
  exonere:     boolean
}

interface DividendLine {
  date:     string
  symbol:   string | null
  amount:   number
  currency: string
}

interface FiscalData {
  year: number
  plusValues: {
    total:    number
    cto:      number
    pea:      number
    exoneres: number
    lines:    FiscalLine[]
  }
  dividends: {
    total: number
    lines: DividendLine[]
  }
  tax: {
    taxableBase:       number
    pfuAmount:         number
    pfuRate:           number
    peaExonereAmount:  number
    irAmount:          number
    socialAmount:      number
  }
}

// Calendrier fiscal simplifié
const FISCAL_EVENTS = [
  { month: 'Février',  label: 'Réception des IFU',              desc: 'Imprimé Fiscal Unique envoyé par votre courtier' },
  { month: 'Avril',    label: 'Ouverture déclaration en ligne',  desc: 'impots.gouv.fr ouvre la déclaration de revenus' },
  { month: 'Mai',      label: 'Date limite de déclaration',      desc: 'Déclaration en ligne — vérifiez votre zone géographique' },
  { month: 'Juillet',  label: 'Acompte prélèvement PFU',         desc: 'Acompte de 60% du PFU estimé prélevé' },
  { month: 'Septembre',label: 'Avis d\'imposition',              desc: 'Réception de l\'avis et régularisation éventuelle' },
]

export default function FiscalScreen() {
  const currentYear = new Date().getFullYear()
  const [year, setYear]             = useState(currentYear)
  const [showLines, setShowLines]   = useState(false)
  const [copiedCase, setCopied]     = useState<string | null>(null)

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const { data, isLoading, refetch, isRefetching } = useQuery<FiscalData>({
    queryKey: ['fiscal', year],
    queryFn:  () => apiFetch(`/api/fiscal?year=${year}`),
  })

  async function copyValue(caseId: string, value: number) {
    const text = value.toFixed(2).replace('.', ',')
    // Affichage visuel de la copie (expo-clipboard non requis en mode strict)
    Alert.alert('Valeur copiée', `${text} €`, [{ text: 'OK' }])
    setCopied(caseId)
    setTimeout(() => setCopied(null), 2000)
  }

  const pv = data?.plusValues
  const dv = data?.dividends
  const tx = data?.tax

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.pageHeader}>
          <View>
            <Text style={s.pageTitle}>Rapport fiscal</Text>
            <Text style={s.pageSub}>Plus-values, dividendes, PFU</Text>
          </View>
        </View>

        {/* ── Sélecteur d'année ───────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.md, paddingHorizontal: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
            {years.map(y => (
              <TouchableOpacity
                key={y}
                style={[s.yearChip, year === y && { backgroundColor: colors.accent + '18', borderColor: colors.accent }]}
                onPress={() => setYear(y)}
                activeOpacity={0.7}
              >
                <Text style={{ color: year === y ? colors.accent : colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' }}>
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />}

        {data && tx && pv && dv && (
          <>
            {/* ── Stats ───────────────────────────────────────────────── */}
            <View style={s.statsRow}>
              <View style={[s.statCard, { borderColor: colors.accent + '40', backgroundColor: colors.accent + '08', flex: 1.2 }]}>
                <Text style={s.statLabel}>Impôt estimé (PFU 30%)</Text>
                <Text style={[s.statValue, { color: colors.accent }]}>{formatCurrency(tx.pfuAmount)}</Text>
                <Text style={s.statSub}>Base : {formatCurrency(tx.taxableBase)}</Text>
              </View>
              <View style={{ flex: 1, gap: spacing.sm }}>
                <View style={s.statCard}>
                  <Text style={s.statLabel}>Plus-values</Text>
                  <Text style={[s.statValue, { color: pv.total >= 0 ? colors.success : colors.danger, fontSize: fontSize.lg }]}>
                    {pv.total >= 0 ? '+' : ''}{formatCurrency(pv.total)}
                  </Text>
                </View>
                <View style={s.statCard}>
                  <Text style={s.statLabel}>Dividendes</Text>
                  <Text style={[s.statValue, { color: colors.success, fontSize: fontSize.lg }]}>{formatCurrency(dv.total)}</Text>
                </View>
              </View>
            </View>

            {/* ── Décomposition PFU ───────────────────────────────────── */}
            <View style={s.card}>
              <View style={s.cardTitleRow}>
                <Ionicons name="receipt-outline" size={15} color={colors.accent} />
                <Text style={s.cardTitle}>Décomposition du PFU</Text>
              </View>
              <View style={{ gap: 10, marginTop: 14 }}>
                {[
                  { label: 'IR (12,8%)',                   val: tx.irAmount          },
                  { label: 'Prélèvements sociaux (17,2%)', val: tx.socialAmount      },
                  { label: 'PS PEA exonéré IR',            val: tx.peaExonereAmount  },
                ].map(r => (
                  <View key={r.label} style={s.pfuRow}>
                    <Text style={s.pfuLabel}>{r.label}</Text>
                    <Text style={s.pfuVal}>{formatCurrency(r.val)}</Text>
                  </View>
                ))}
                <View style={[s.pfuRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
                  <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '700' }}>Total estimé</Text>
                  <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontWeight: '700' }}>
                    {formatCurrency(tx.pfuAmount + tx.peaExonereAmount)}
                  </Text>
                </View>
              </View>
              <View style={s.infoBox}>
                <Ionicons name="information-circle-outline" size={13} color={colors.accent} />
                <Text style={s.infoText}>
                  Estimation indicative PFU 30%. Consultez un conseiller fiscal pour votre déclaration officielle.
                </Text>
              </View>
            </View>

            {/* ── Guide 2042-C ────────────────────────────────────────── */}
            <View style={s.card}>
              <View style={s.cardTitleRow}>
                <Ionicons name="document-text-outline" size={15} color={colors.accent} />
                <Text style={s.cardTitle}>Guide déclaration 2042-C</Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4, marginBottom: 12 }}>
                Copiez les montants directement dans votre déclaration sur impots.gouv.fr
              </Text>

              {[
                {
                  id:    '3VG',
                  label: 'Case 3VG — Plus-values imposables (CTO)',
                  value: Math.max(0, pv.cto),
                  desc:  'Plus-values nettes réalisées sur votre CTO',
                  hi:    pv.cto > 0,
                },
                {
                  id:    '3VH',
                  label: 'Case 3VH — Moins-values',
                  value: Math.abs(Math.min(0, pv.cto)),
                  desc:  'Moins-values nettes (si CTO en perte)',
                  hi:    pv.cto < 0,
                },
                {
                  id:    '2DC',
                  label: 'Case 2DC — Dividendes bruts',
                  value: dv.total,
                  desc:  'Dividendes perçus hors PEA',
                  hi:    dv.total > 0,
                },
                {
                  id:    '2CG',
                  label: 'Case 2CG — CSG déductible',
                  value: dv.total * 0.068,
                  desc:  '6,8% des dividendes (si option barème progressif)',
                  hi:    false,
                },
              ].map(row => (
                <View key={row.id} style={[s.caseRow, row.hi && row.value > 0 && { backgroundColor: colors.accent + '08', borderColor: colors.accent + '25' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' }}>{row.label}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>{row.desc}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: row.value > 0 ? colors.accent : colors.textMuted, fontSize: fontSize.sm, fontWeight: '700' }}>
                      {row.value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </Text>
                    <TouchableOpacity
                      onPress={() => copyValue(row.id, row.value)}
                      style={s.copyBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={copiedCase === row.id ? 'checkmark' : 'copy-outline'}
                        size={11}
                        color={copiedCase === row.id ? colors.success : colors.textMuted}
                      />
                      <Text style={{ color: copiedCase === row.id ? colors.success : colors.textMuted, fontSize: 10 }}>
                        {copiedCase === row.id ? 'Copié' : 'Copier'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={[s.infoBox, { backgroundColor: '#3B82F615', borderColor: '#3B82F630' }]}>
                <Ionicons name="information-circle-outline" size={13} color="#3B82F6" />
                <Text style={[s.infoText, { color: '#60A5FA' }]}>
                  PEA — Rien à déclarer. Les plus-values et dividendes PEA sont exonérés d'IR après 5 ans.
                  {pv.pea > 0 ? ` Vos PV PEA de ${formatCurrency(pv.pea)} restent hors déclaration.` : ''}
                </Text>
              </View>
            </View>

            {/* ── Détail des cessions ─────────────────────────────────── */}
            {pv.lines.length > 0 && (
              <TouchableOpacity
                style={s.card}
                onPress={() => setShowLines(v => !v)}
                activeOpacity={0.8}
              >
                <View style={s.cardTitleRow}>
                  <Ionicons name="trending-up-outline" size={15} color={colors.success} />
                  <Text style={s.cardTitle}>Détail des cessions ({pv.lines.length})</Text>
                  <Ionicons name={showLines ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
                </View>
                {showLines && (
                  <View style={{ gap: 8, marginTop: 14 }}>
                    {pv.lines.map((l, i) => (
                      <View key={i} style={s.lineRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' }}>{l.symbol}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>
                            {new Date(l.date).toLocaleDateString('fr-FR')} · {l.quantity} part{l.quantity > 1 ? 's' : ''}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: l.plusValue >= 0 ? colors.success : colors.danger, fontSize: fontSize.sm, fontWeight: '700' }}>
                            {l.plusValue >= 0 ? '+' : ''}{formatCurrency(l.plusValue)}
                          </Text>
                          <View style={[s.acctBadge, { backgroundColor: l.exonere ? colors.accent + '18' : colors.purple + '18' }]}>
                            <Text style={{ color: l.exonere ? colors.accent : colors.purple, fontSize: 9, fontWeight: '700' }}>
                              {l.exonere ? 'PEA OK' : l.accountType}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* ── Dividendes ──────────────────────────────────────────── */}
            {dv.lines.length > 0 && (
              <View style={s.card}>
                <View style={s.cardTitleRow}>
                  <Ionicons name="cash-outline" size={15} color={colors.accent} />
                  <Text style={s.cardTitle}>Dividendes perçus</Text>
                </View>
                <View style={{ gap: 8, marginTop: 14 }}>
                  {dv.lines.map((d, i) => (
                    <View key={i} style={s.lineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' }}>{d.symbol ?? '—'}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>
                          {new Date(d.date).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                      <Text style={{ color: colors.success, fontSize: fontSize.sm, fontWeight: '700' }}>
                        +{formatCurrency(d.amount, d.currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {pv.lines.length === 0 && dv.lines.length === 0 && (
              <View style={[s.card, { alignItems: 'center', paddingVertical: 32 }]}>
                <Ionicons name="document-outline" size={36} color={colors.textMuted} style={{ marginBottom: 10 }} />
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.md, fontWeight: '600' }}>
                  Aucune opération fiscale en {year}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, textAlign: 'center' }}>
                  Enregistrez vos ventes et dividendes dans les transactions.
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── Calendrier fiscal ───────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <Ionicons name="calendar-outline" size={15} color={colors.accent} />
            <Text style={s.cardTitle}>Calendrier fiscal {year}</Text>
          </View>
          <View style={{ gap: 12, marginTop: 14 }}>
            {FISCAL_EVENTS.map((ev, i) => (
              <View key={i} style={s.calRow}>
                <View style={s.calDot} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: colors.accent, fontSize: fontSize.xs, fontWeight: '700', minWidth: 70 }}>{ev.month}</Text>
                    <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600', flex: 1 }}>{ev.label}</Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2, marginLeft: 78 }}>{ev.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },

  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageTitle:  { color: colors.textPrimary, fontSize: fontSize['2xl'], fontWeight: '700', letterSpacing: -0.5 },
  pageSub:    { color: colors.textMuted,   fontSize: fontSize.sm, marginTop: 2 },

  yearChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  statLabel: { color: colors.textMuted,    fontSize: fontSize.xs, marginBottom: 4 },
  statValue: { color: colors.textPrimary,  fontSize: fontSize.xl, fontWeight: '700', letterSpacing: -0.5 },
  statSub:   { color: colors.textMuted,    fontSize: fontSize.xs, marginTop: 2 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle:    { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },

  pfuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pfuLabel: { color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 },
  pfuVal:   { color: colors.textPrimary,   fontSize: fontSize.sm, fontWeight: '600' },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.accent + '0A', borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.accent + '20',
    paddingHorizontal: 10, paddingVertical: 8, marginTop: 10,
  },
  infoText: { color: colors.textMuted, fontSize: fontSize.xs, flex: 1, lineHeight: 16 },

  caseRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.surface2, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6,
  },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  lineRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '60',
  },
  acctBadge: { borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },

  calRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  calDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.accent, marginTop: 4, flexShrink: 0,
  },
})

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  AppState,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { colors, fontSize, radius, spacing } from '@/constants/theme'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BankAccount {
  id:          string
  nordigenId:  string
  iban?:       string | null
  name?:       string | null
  currency:    string
  balance:     number
  balanceType: string | null
  updatedAt:   string
}

interface BankConnection {
  id:              string
  institutionName: string | null
  status:          string   // PENDING | LINKED | EXPIRED | ERROR
  validUntil?:     string | null
  lastSyncAt?:     string | null
  createdAt:       string
  accounts:        BankAccount[]
}

interface EBBank {
  name:    string
  country: string
  bic?:    string
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function fmt(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(amount)
}

function joursRestants(validUntil?: string | null): number | null {
  if (!validUntil) return null
  const diff = new Date(validUntil).getTime() - Date.now()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

// ── Écran principal ───────────────────────────────────────────────────────────

export default function BankingScreen() {
  const queryClient                 = useQueryClient()
  const [showModal, setShowModal]   = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const [connecting, setConnecting] = useState(false)
  const appStateRef                 = useRef(AppState.currentState)

  // Recharge les connexions quand l'app revient au premier plan (après l'OAuth dans le navigateur)
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        queryClient.invalidateQueries({ queryKey: ['bank-connections'] })
      }
      appStateRef.current = nextState
    })
    return () => sub.remove()
  }, [queryClient])

  // ── Liste des connexions ──
  const { data: connections = [], isLoading, refetch, isRefetching } = useQuery<BankConnection[]>({
    queryKey: ['bank-connections'],
    queryFn:  () => apiFetch('/api/bank/sync'),
  })

  // ── Recherche de banques ──
  const { data: banks = [], isFetching: rechercheEnCours } = useQuery<EBBank[]>({
    queryKey:  ['eb-banks', bankSearch],
    queryFn:   () => apiFetch(`/api/bank/institutions?country=FR&q=${encodeURIComponent(bankSearch)}`),
    enabled:   showModal,
    staleTime: 60_000,
  })

  // ── Connexion à une banque ──
  const connectMutation = useMutation({
    mutationFn: (bankName: string) =>
      apiFetch<{ link: string; connectionId: string }>('/api/bank/connect', {
        method: 'POST',
        body:   JSON.stringify({ bankName, country: 'FR', platform: 'mobile' }),
      }),
    onSuccess: async ({ link }) => {
      setShowModal(false)
      setConnecting(true)
      try {
        await Linking.openURL(link)
      } catch {
        Alert.alert('Erreur', 'Impossible d\'ouvrir le navigateur')
      } finally {
        setConnecting(false)
      }
    },
    onError: (e: any) => {
      Alert.alert('Erreur de connexion', e?.message ?? 'Impossible de se connecter à la banque')
    },
  })

  // ── Synchronisation ──
  const syncMutation = useMutation({
    mutationFn: (connectionId: string) =>
      apiFetch('/api/bank/sync', {
        method: 'POST',
        body:   JSON.stringify({ connectionId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-connections'] }),
    onError:   (e: any) => Alert.alert('Erreur de synchronisation', e?.message),
  })

  // ── Suppression ──
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch('/api/bank/sync', { method: 'DELETE', body: JSON.stringify({ id }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-connections'] }),
  })

  const confirmerSuppression = useCallback((conn: BankConnection) => {
    Alert.alert(
      'Déconnecter',
      `Supprimer la connexion avec ${conn.institutionName ?? 'cette banque'} ?`,
      [
        { text: 'Annuler',    style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteMutation.mutate(conn.id) },
      ]
    )
  }, [deleteMutation])

  const connectees = connections.filter(c => c.status === 'LINKED')
  const expirees   = connections.filter(c => c.status === 'EXPIRED')

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
      >
        {/* En-tête */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Comptes bancaires</Text>
            <Text style={s.subtitle}>Open Banking · PSD2</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)} activeOpacity={0.8}>
            <Ionicons name="add" size={22} color={colors.background} />
          </TouchableOpacity>
        </View>

        {/* Chargement */}
        {isLoading && (
          <View style={s.centreSpin}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        )}

        {/* État vide */}
        {!isLoading && connections.length === 0 && (
          <View style={s.carteVide}>
            <Ionicons name="library-outline" size={48} color={colors.textMuted} style={{ marginBottom: 16 }} />
            <Text style={s.titreVide}>Aucune banque connectée</Text>
            <Text style={s.descVide}>
              Connectez votre banque pour voir vos soldes en temps réel via le standard PSD2 européen.
            </Text>
            <TouchableOpacity style={s.btnConnecter} onPress={() => setShowModal(true)} activeOpacity={0.8}>
              <Ionicons name="link-outline" size={18} color={colors.background} style={{ marginRight: 8 }} />
              <Text style={s.btnConnecterTexte}>Connecter ma banque</Text>
            </TouchableOpacity>
            <View style={s.badgesRow}>
              <View style={s.badge}><Text style={s.badgeTexte}>🔒 Lecture seule</Text></View>
              <View style={s.badge}><Text style={s.badgeTexte}>🇪🇺 PSD2</Text></View>
              <View style={s.badge}><Text style={s.badgeTexte}>✅ Gratuit</Text></View>
            </View>
          </View>
        )}

        {/* Connexions actives */}
        {connectees.map(conn => (
          <CarteConnexion
            key={conn.id}
            connexion={conn}
            onSync={() => syncMutation.mutate(conn.id)}
            onSupprimer={() => confirmerSuppression(conn)}
            syncEnCours={syncMutation.isPending && (syncMutation.variables as string) === conn.id}
          />
        ))}

        {/* Connexions expirées */}
        {expirees.map(conn => (
          <View key={conn.id} style={[s.carte, s.carteExpiree]}>
            <View style={s.carteEntete}>
              <View style={[s.iconeBox, { backgroundColor: colors.danger + '22' }]}>
                <Ionicons name="alert-circle-outline" size={22} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.nomBanque}>{conn.institutionName ?? 'Banque'}</Text>
                <Text style={[s.statut, { color: colors.danger }]}>Consentement expiré</Text>
              </View>
              <TouchableOpacity onPress={() => confirmerSuppression(conn)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={s.msgExpire}>
              Le consentement DSP2 (90 jours) a expiré. Reconnectez votre banque pour continuer.
            </Text>
            <TouchableOpacity
              style={[s.btnConnecter, { marginTop: 12 }]}
              onPress={() => connectMutation.mutate(conn.institutionName ?? '')}
              activeOpacity={0.8}
            >
              <Text style={s.btnConnecterTexte}>Reconnecter</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Note DSP2 */}
        {connections.length > 0 && (
          <View style={s.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
            <Text style={s.infoTexte}>
              Conformément à la DSP2, l'accès est limité à 90 jours et en lecture seule. Aucune opération n'est effectuée depuis l'application.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Modal de sélection de banque */}
      <ModalBanque
        visible={showModal}
        onFermer={() => setShowModal(false)}
        recherche={bankSearch}
        onRechercheChange={setBankSearch}
        banks={banks}
        rechercheEnCours={rechercheEnCours}
        onSelectionner={nom => connectMutation.mutate(nom)}
        connexionEnCours={connectMutation.isPending || connecting}
      />
    </SafeAreaView>
  )
}

// ── Carte de connexion ────────────────────────────────────────────────────────

function CarteConnexion({
  connexion, onSync, onSupprimer, syncEnCours,
}: {
  connexion:    BankConnection
  onSync:       () => void
  onSupprimer:  () => void
  syncEnCours:  boolean
}) {
  const jours         = joursRestants(connexion.validUntil)
  const soldeTotal    = connexion.accounts.reduce((s, a) => s + a.balance, 0)

  return (
    <View style={s.carte}>
      {/* En-tête carte */}
      <View style={s.carteEntete}>
        <View style={[s.iconeBox, { backgroundColor: colors.accent + '1A' }]}>
          <Ionicons name="business-outline" size={22} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.nomBanque}>{connexion.institutionName ?? 'Banque'}</Text>
          {jours !== null && (
            <Text style={[s.statut, { color: jours < 14 ? colors.warning : colors.success }]}>
              {jours > 0 ? `Expire dans ${jours} jour${jours > 1 ? 's' : ''}` : 'Expire aujourd\'hui'}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={onSync} disabled={syncEnCours} style={s.btnSync} hitSlop={8}>
          {syncEnCours
            ? <ActivityIndicator size="small" color={colors.accent} />
            : <Ionicons name="refresh-outline" size={20} color={colors.accent} />
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={onSupprimer} hitSlop={8} style={{ marginLeft: 8 }}>
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Solde total */}
      <View style={s.ligneTotal}>
        <Text style={s.labelTotal}>Solde total</Text>
        <Text style={s.valeurTotal}>{fmt(soldeTotal)}</Text>
      </View>

      {/* Liste des comptes */}
      {connexion.accounts.map(compte => (
        <View key={compte.id} style={s.ligneCompte}>
          <View style={{ flex: 1 }}>
            <Text style={s.nomCompte}>{compte.name ?? 'Compte'}</Text>
            {compte.iban && (
              <Text style={s.ibanCompte}>
                {compte.iban.replace(/(.{4})/g, '$1 ').trim()}
              </Text>
            )}
          </View>
          <Text style={[s.soldeCompte, { color: compte.balance >= 0 ? colors.textPrimary : colors.danger }]}>
            {fmt(compte.balance, compte.currency)}
          </Text>
        </View>
      ))}

      {connexion.accounts.length === 0 && (
        <Text style={s.aucunCompte}>Aucun compte — synchronisez pour charger</Text>
      )}

      {connexion.lastSyncAt && (
        <Text style={s.dernierSync}>
          Dernière sync : {new Date(connexion.lastSyncAt).toLocaleString('fr-FR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      )}
    </View>
  )
}

// ── Modal de sélection de banque ──────────────────────────────────────────────

function ModalBanque({
  visible, onFermer, recherche, onRechercheChange,
  banks, rechercheEnCours, onSelectionner, connexionEnCours,
}: {
  visible:           boolean
  onFermer:          () => void
  recherche:         string
  onRechercheChange: (v: string) => void
  banks:             EBBank[]
  rechercheEnCours:  boolean
  onSelectionner:    (nom: string) => void
  connexionEnCours:  boolean
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <View style={m.fond}>
        <View style={m.feuille}>
          <View style={m.poignee} />
          <Text style={m.titre}>Choisir votre banque</Text>

          <View style={m.ligneRecherche}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={m.input}
              placeholder="BNP, Crédit Agricole, Boursorama…"
              placeholderTextColor={colors.textMuted}
              value={recherche}
              onChangeText={onRechercheChange}
              autoFocus
            />
          </View>

          {rechercheEnCours && (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
          )}

          <ScrollView style={m.liste} keyboardShouldPersistTaps="handled">
            {banks.map((bank, i) => (
              <TouchableOpacity
                key={i}
                style={m.ligneBanque}
                onPress={() => !connexionEnCours && onSelectionner(bank.name)}
                activeOpacity={0.7}
                disabled={connexionEnCours}
              >
                <View style={m.iconeBanque}>
                  <Ionicons name="business-outline" size={20} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.nomBanque}>{bank.name}</Text>
                  {bank.bic && <Text style={m.bicBanque}>{bank.bic}</Text>}
                </View>
                {connexionEnCours
                  ? <ActivityIndicator size="small" color={colors.accent} />
                  : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                }
              </TouchableOpacity>
            ))}

            {!rechercheEnCours && banks.length === 0 && recherche.length > 0 && (
              <Text style={m.aucunResultat}>Aucune banque trouvée pour « {recherche} »</Text>
            )}

            {!rechercheEnCours && banks.length === 0 && recherche.length === 0 && (
              <Text style={m.indice}>Commencez à saisir le nom de votre banque</Text>
            )}
          </ScrollView>

          <TouchableOpacity style={m.btnFermer} onPress={onFermer}>
            <Text style={m.btnFermerTexte}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },

  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.sm,
  },
  title: {
    fontSize:      28,
    fontWeight:    '700',
    color:         colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize:  fontSize.xs,
    color:     colors.textMuted,
    marginTop: 2,
  },
  addBtn: {
    width:           40,
    height:          40,
    borderRadius:    radius.full,
    backgroundColor: colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },

  centreSpin: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 60,
  },

  // État vide
  carteVide: {
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.xl,
    alignItems:      'center',
  },
  titreVide: {
    fontSize:     fontSize.lg,
    fontWeight:   '600',
    color:        colors.textPrimary,
    marginBottom: 8,
  },
  descVide: {
    fontSize:     fontSize.sm,
    color:        colors.textMuted,
    textAlign:    'center',
    lineHeight:   20,
    marginBottom: 20,
  },
  btnConnecter: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.accent,
    paddingHorizontal: 20,
    paddingVertical:   12,
    borderRadius:      radius.full,
    marginBottom:      16,
  },
  btnConnecterTexte: {
    fontSize:   fontSize.md,
    fontWeight: '600',
    color:      colors.background,
  },
  badgesRow: {
    flexDirection: 'row',
    gap:           8,
  },
  badge: {
    backgroundColor:   colors.surface2,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      radius.full,
  },
  badgeTexte: {
    fontSize: fontSize.xs,
    color:    colors.textSecondary,
  },

  // Carte connexion
  carte: {
    backgroundColor: colors.surface,
    borderRadius:    radius.xl,
    borderWidth:     1,
    borderColor:     colors.border,
    padding:         spacing.md,
  },
  carteExpiree: {
    borderColor: colors.danger + '44',
  },
  carteEntete: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.sm,
    gap:           10,
  },
  iconeBox: {
    width:          44,
    height:         44,
    borderRadius:   radius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  nomBanque: {
    fontSize:   fontSize.md,
    fontWeight: '600',
    color:      colors.textPrimary,
  },
  statut: {
    fontSize:  fontSize.xs,
    marginTop: 2,
  },
  btnSync: {
    width:          36,
    height:         36,
    borderRadius:   radius.md,
    backgroundColor: colors.accent + '1A',
    alignItems:     'center',
    justifyContent: 'center',
  },

  ligneTotal: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    backgroundColor: colors.surface2,
    borderRadius:    radius.md,
    padding:         spacing.sm,
    marginBottom:    spacing.sm,
  },
  labelTotal: {
    fontSize: fontSize.sm,
    color:    colors.textMuted,
  },
  valeurTotal: {
    fontSize:   fontSize.md,
    fontWeight: '700',
    color:      colors.textPrimary,
  },

  ligneCompte: {
    flexDirection:      'row',
    alignItems:         'center',
    paddingVertical:    8,
    borderBottomWidth:  1,
    borderBottomColor:  colors.border,
  },
  nomCompte: {
    fontSize:   fontSize.sm,
    fontWeight: '500',
    color:      colors.textPrimary,
  },
  ibanCompte: {
    fontSize:  fontSize.xs,
    color:     colors.textMuted,
    marginTop: 2,
  },
  soldeCompte: {
    fontSize:   fontSize.md,
    fontWeight: '600',
  },
  aucunCompte: {
    fontSize:        fontSize.xs,
    color:           colors.textMuted,
    textAlign:       'center',
    paddingVertical: 12,
  },
  dernierSync: {
    fontSize:  fontSize.xs,
    color:     colors.textMuted,
    marginTop: 8,
    textAlign: 'right',
  },
  msgExpire: {
    fontSize:  fontSize.sm,
    color:     colors.textMuted,
    marginTop: 4,
  },

  // Encadré info DSP2
  infoBox: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.sm,
    borderWidth:     1,
    borderColor:     colors.border,
  },
  infoTexte: {
    flex:       1,
    fontSize:   fontSize.xs,
    color:      colors.textMuted,
    lineHeight: 18,
  },
})

const m = StyleSheet.create({
  fond: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent:  'flex-end',
  },
  feuille: {
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    padding:              spacing.lg,
    maxHeight:            '85%',
  },
  poignee: {
    width:           40,
    height:          4,
    backgroundColor: colors.border,
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    spacing.md,
  },
  titre: {
    fontSize:     fontSize.lg,
    fontWeight:   '700',
    color:        colors.textPrimary,
    marginBottom: spacing.md,
  },
  ligneRecherche: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   colors.surface2,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingHorizontal: spacing.sm,
    marginBottom:      spacing.sm,
  },
  input: {
    flex:            1,
    paddingVertical: 10,
    fontSize:        fontSize.md,
    color:           colors.textPrimary,
  },
  liste: { maxHeight: 360 },
  ligneBanque: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               12,
  },
  iconeBanque: {
    width:          40,
    height:         40,
    borderRadius:   radius.md,
    backgroundColor: colors.accent + '1A',
    alignItems:     'center',
    justifyContent: 'center',
  },
  nomBanque: {
    fontSize:   fontSize.md,
    fontWeight: '500',
    color:      colors.textPrimary,
  },
  bicBanque: {
    fontSize: fontSize.xs,
    color:    colors.textMuted,
  },
  aucunResultat: {
    fontSize:        fontSize.sm,
    color:           colors.textMuted,
    textAlign:       'center',
    paddingVertical: 24,
  },
  indice: {
    fontSize:        fontSize.sm,
    color:           colors.textMuted,
    textAlign:       'center',
    paddingVertical: 32,
  },
  btnFermer: {
    backgroundColor: colors.surface2,
    borderRadius:    radius.full,
    padding:         spacing.md,
    alignItems:      'center',
    marginTop:       spacing.md,
  },
  btnFermerTexte: {
    fontSize:   fontSize.md,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
})

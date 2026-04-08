# Finexa Mobile — Plan de développement

> **Objectif** : Application mobile React Native (Expo) avec parité totale de features avec le site web Finexa.
> **Stack** : Expo SDK 54, Expo Router v6, TanStack Query v5, Zustand, expo-secure-store
> **API** : Toutes les routes existent déjà côté Next.js — le mobile consomme la même API que le web.
> **URL prod** : `https://finexa-dev.vercel.app`
> **Dernière mise à jour** : 2026-04-02

---

## État global

| Écran | Statut | Priorité |
|---|---|---|
| Auth (login / register / forgot / reset) | ✅ Fait | — |
| Navigation (tabs + écrans cachés) | ✅ Fait | — |
| Dashboard (stats, wealth chart, health score, milestones) | ✅ Fait | — |
| Portfolio (holdings, P&L live, ajout holding) | ✅ Fait | — |
| Budget (50/30/20, items, income) | ✅ Fait | — |
| Transactions (liste) | ✅ Fait | — |
| Objectifs / Goals (CRUD + progress) | ✅ Fait | — |
| Fiscal (calcul PFU, PEA, dividendes) | ✅ Fait | — |
| Simulateur (intérêts composés) | ✅ Fait | — |
| Assistant IA (chat Gemini) | ✅ Fait | — |
| Assets (CRUD complet) | ✅ Fait | — |
| Paramètres / Alertes prix | ✅ Fait | — |
| Pokémon collection | ✅ Fait | — |
| Profile screen | ✅ Fait | — |
| Charts interactifs (portfolio perf, secteurs) | ❌ À faire | 🟠 P2 |
| Budget — CRUD items + graphique camembert | ✅ Fait | — |
| Transactions — CRUD + filtres | ✅ Fait | — |
| Dashboard — revenus passifs + projection | ❌ À faire | 🟠 P2 |
| Settings — changement MDP + 2FA | ❌ À faire | 🟠 P2 |
| Notifications push (expo-notifications) | ❌ À faire | 🟡 P3 |
| Onboarding first-launch | ❌ À faire | 🟡 P3 |
| Cache offline (MMKV + persist Query) | ❌ À faire | 🟡 P3 |
| EAS Build + Publication App Store / Play Store | ❌ À faire | 🟡 P3 |

---

## Détail par écran

### ✅ Auth
- **login.tsx** — email + password, lien MDP oublié, lien créer compte
- **register.tsx** — nom / email / password + vérification OTP par email → auto-login
- **forgot-password.tsx** — envoi email de reset
- **reset-password.tsx** — nouveau password via token URL
- **_layout.tsx (root)** — AuthGuard (redirige vers login si non connecté)

---

### ✅ Dashboard (`index.tsx`)
- Cartes stats : patrimoine total, variation mensuelle, allocation par type
- WealthChart (courbe patrimoniale historique)
- HealthScore (score diversification / risque)
- Milestones (jalons patrimoniaux)
- Pull-to-refresh
- **À ajouter** : revenus passifs, projection patrimoniale (Phase 2)

---

### ✅ Portfolio (`portfolio.tsx` + `portfolio/add.tsx`)
- Liste holdings avec prix live (refetch 10s)
- P&L par ligne (valeur actuelle vs prix d'achat moyen)
- Flash animation sur changement de prix
- Carte P&L total en haut
- Bouton + → `portfolio/add.tsx` (recherche symbole + formulaire)
- **À ajouter** :
  - Graphique performance vs benchmark (Phase 2)
  - Répartition sectorielle (Phase 2)
  - Analyse risque / volatilité (Phase 2)
  - Exposition devises (Phase 2)

---

### ⚠️ Budget (`budget.tsx`) — PRIORITÉ 1
- ✅ Affichage revenu mensuel
- ✅ Liste items par catégorie (besoins / envies / épargne)
- ✅ Règle 50/30/20 affichée
- ❌ CRUD items (ajout / édition / suppression)
- ❌ Édition inline du revenu avec sauvegarde
- ❌ Graphique camembert répartition
- ❌ Vue cashflow mensuel

---

### ⚠️ Transactions (`transactions.tsx`) — PRIORITÉ 1
- ✅ Liste transactions avec badge type coloré
- ✅ Pull-to-refresh
- ❌ Filtres par type / symbole / date
- ❌ CRUD (ajout / édition / suppression)
- ❌ Import CSV

---

### ✅ Objectifs (`goals.tsx`)
- Liste objectifs avec barre de progression
- CRUD complet (ajout / édition / suppression) via modal
- Calcul progression automatique depuis le portefeuille
- **À ajouter** : graphique évolution vers l'objectif (Phase 2)

---

### ✅ Fiscal (`fiscal.tsx`)
- Calcul plus-values réalisées
- PFU 30% + prélèvements sociaux
- Exonération PEA
- **À ajouter** : calendrier fiscal, historique par année, export PDF

---

### ✅ Simulateur (`simulator.tsx`)
- Capital initial, versements mensuels, taux annuel, durée
- Formule intérêts composés : `Vf = Vi × (1 + ρ/n)^(n×t) + versements`
- **À ajouter** : graphique de projection interactif (Phase 2)

---

### ✅ Assistant IA (`assistant.tsx`)
- Chat avec Gemini 2.0 Flash
- Suggestions rapides contextuelles
- Streaming des réponses
- **À ajouter** : historique persistant, contexte portfolio injecté auto

---

### ✅ Assets (`assets.tsx`)
- Liste actifs (compte bancaire, épargne, immobilier, actions, crypto, autre)
- CRUD complet via modal
- **À ajouter** : import CSV holdings, vue détail par actif

---

### ✅ Paramètres (`settings.tsx`)
- Alertes prix CRUD (symbole, condition above/below, valeur cible)
- **À ajouter** :
  - Changement mot de passe (Phase 2)
  - Setup / désactivation 2FA (Phase 2)
  - Connexion bancaire Tink (quand approbation prod reçue)
  - Préférences devise / langue

---

### ✅ Pokémon (`pokemon.tsx`)
- Collection cartes / sealed
- CRUD complet
- Recherche avec image preview
- Estimation de valeur

---

### ❌ Profile (`profile.tsx`) — PRIORITÉ 2
- Skeleton actuellement
- **À construire** :
  - Infos utilisateur (nom, email, date inscription)
  - Stats rapides (nb actifs, nb transactions)
  - Bouton déconnexion
  - Avatar / initiales

---

### ❌ Notifications push — PRIORITÉ 3
- Installer `expo-notifications`
- Demander permission au launch
- Lier aux alertes prix : notif push quand alerte déclenchée
- Backend : stocker `pushToken` via `/api/auth/device-token` (route existe déjà)

---

## Prochaines étapes — Phase 1 (CRUD manquants)

```
[ ] Budget : CRUD items (modal ajout/edit) + édition revenu + camembert
[ ] Transactions : modal ajout + filtres type/date
[ ] Profile : infos user + logout
```

## Phase 2 (Charts & polish)

```
[ ] Portfolio : graphique performance + secteurs
[ ] Dashboard : revenus passifs + projection
[ ] Settings : changement MDP + 2FA
[ ] Simulateur : graphique projection
```

## Phase 3 (Infrastructure & publication)

```
[ ] Notifications push (expo-notifications)
[ ] Onboarding first-launch
[ ] Cache offline (MMKV)
[ ] EAS Build config (eas.json)
[ ] App Store Connect setup
[ ] Google Play Console setup
[ ] TestFlight bêta
[ ] Publication
```

---

## Architecture technique

```
mobile/
├── app/
│   ├── _layout.tsx           # Root : AuthGuard, QueryClientProvider, GestureHandler
│   ├── login.tsx
│   ├── register.tsx
│   ├── forgot-password.tsx
│   ├── reset-password.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Bottom tab bar (5 icônes + écrans cachés)
│   │   ├── index.tsx         # Dashboard
│   │   ├── portfolio.tsx
│   │   ├── budget.tsx
│   │   ├── goals.tsx
│   │   ├── more.tsx          # Hub → autres écrans
│   │   ├── transactions.tsx
│   │   ├── assets.tsx
│   │   ├── fiscal.tsx
│   │   ├── simulator.tsx
│   │   ├── assistant.tsx
│   │   ├── settings.tsx
│   │   ├── profile.tsx
│   │   └── pokemon.tsx
│   └── portfolio/
│       └── add.tsx           # Ajout holding (recherche + formulaire)
├── components/
│   ├── ui/                   # Card, StatCard, Badge
│   ├── WealthChart.tsx       # Courbe SVG historique
│   ├── HealthScore.tsx       # Score circulaire
│   └── Milestones.tsx        # Jalons patrimoniaux
├── constants/
│   ├── api.ts                # API_BASE = https://finexa-dev.vercel.app
│   └── theme.ts              # bg #0A0A0A, surface #1C1C1E, accent #C9A84C
├── lib/
│   ├── api.ts                # apiFetch + formatCurrency + formatPercent
│   ├── auth.ts               # getToken / saveToken (expo-secure-store)
│   └── store.ts              # Zustand : { user, token, login, logout }
└── PLAN.md                   # Ce fichier — à mettre à jour à chaque session
```

---

## Notes clés

| Sujet | Info |
|---|---|
| Lancer l'app | `cd mobile && npm run tunnel` (réseau bloqué) ou `npm start` (même WiFi) |
| Auth mobile | JWT 30j via `POST /api/auth/mobile`, stocké expo-secure-store |
| Alias `@/` | Résolu par babel-plugin-module-resolver (pas tsconfig) |
| Nouvelle archi | `newArchEnabled: false` dans app.json (compat Expo Go) |
| Reanimated | v3.16.7 (pas v4 — incompatible Expo Go sans worklets) |
| Tink banking | En attente approbation prod — activer quand réponse reçue |
| URL prod | `https://finexa-dev.vercel.app` (pas `financy-web.vercel.app`) |

// URL de l'API — toujours utiliser Vercel (localhost ne fonctionne pas sur un vrai téléphone)
// Pour dev local sur émulateur Android: http://10.0.2.2:3000
// Pour dev local sur iPhone simulateur: http://localhost:3000
// Pour un vrai téléphone: utiliser l'URL Vercel ci-dessous
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://finexa-dev.vercel.app'


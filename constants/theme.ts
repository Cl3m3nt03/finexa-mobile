// ── Obsidian Diamond — Design System Mobile ─────────────────────────────────
// Synchronisé avec le design web (globals.css)

export const colors = {
  // Backgrounds — "Obsidian"
  background:  '#08090A',   // Obsidian Deep
  surface:     '#141619',   // Titanium Black
  surface2:    '#1C2026',   // Titanium Black +
  border:      '#2C2F36',   // Graphite

  // Text
  textPrimary:   '#F4F4F6', // Pearl White
  textSecondary: '#8E939F', // Steel Gray
  textMuted:     '#5A6070', // Steel Gray dim

  // Accent — "Diamond Blue"
  accent:      '#BDEFFF',
  accentGlow:  'rgba(189, 239, 255, 0.08)',
  accentDark:  '#7ECDE8',

  // Status
  success:  '#10B981',
  danger:   '#E55C5C',
  warning:  '#F59E0B',
  purple:   '#8B5CF6',
  sapphire: '#3D5A80',

  // Budget categories
  needs:   '#BDEFFF',
  wants:   '#8B5CF6',
  savings: '#10B981',
} as const

export const spacing = {
  xs:    4,
  sm:    8,
  md:   16,
  lg:   24,
  xl:   32,
  '2xl': 48,
} as const

export const radius = {
  sm:   6,
  md:  10,
  lg:  14,
  xl:  20,
  full: 9999,
} as const

export const fontSize = {
  xs:    11,
  sm:    13,
  md:    15,
  lg:    17,
  xl:    20,
  '2xl': 24,
  '3xl': 30,
} as const

export const fontWeight = {
  normal:   '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
}

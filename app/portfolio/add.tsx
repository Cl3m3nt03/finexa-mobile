import { useState } from 'react'
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

const TYPES = [
  { value: 'BANK_ACCOUNT', label: 'Compte' },
  { value: 'SAVINGS',      label: 'Épargne' },
  { value: 'REAL_ESTATE',  label: 'Immobilier' },
  { value: 'OTHER',        label: 'Autre' },
]

export default function AddAssetScreen() {
  const [name, setName] = useState('')
  const [type, setType] = useState('BANK_ACCOUNT')
  const [value, setValue] = useState('')
  const [institution, setInstitution] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  async function handleSubmit() {
    if (!name || !value) return
    setIsSubmitting(true)
    try {
      await apiFetch('/api/assets', {
        method: 'POST',
        body: JSON.stringify({
          name,
          type,
          value: parseFloat(value.replace(',', '.')) || 0,
          institution: institution || undefined,
          currency: 'EUR'
        })
      })
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
      router.back()
    } catch (err) {
      alert("Erreur lors de l'ajout de l'actif")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Ajouter un actif</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.inputGroup}>
          <Text style={s.label}>Nom de l'actif *</Text>
          <TextInput
            style={s.input}
            placeholder="Ex: Livret A"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={s.inputGroup}>
          <Text style={s.label}>Valeur actuelle (€) *</Text>
          <TextInput
            style={s.input}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={value}
            onChangeText={setValue}
          />
        </View>

        <View style={s.inputGroup}>
          <Text style={s.label}>Établissement (Optionnel)</Text>
          <TextInput
            style={s.input}
            placeholder="Ex: BNP Paribas"
            placeholderTextColor={colors.textMuted}
            value={institution}
            onChangeText={setInstitution}
          />
        </View>

        <View style={s.inputGroup}>
          <Text style={s.label}>Type d'actif</Text>
          <View style={s.typeGrid}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[s.typeCard, type === t.value && s.typeCardActive]}
                onPress={() => setType(t.value)}
              >
                <Text style={[s.typeText, type === t.value && s.typeTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <Text style={s.infoText}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          {' '}Pour ajouter des actifs boursiers ou cryptographiques, veuillez utiliser l'application web.
        </Text>

      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.submitBtn, (!name || !value || isSubmitting) && s.submitBtnDisabled]}
          disabled={!name || !value || isSubmitting}
          onPress={handleSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.submitText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  scroll: {
    padding: spacing.md,
    gap: spacing.lg,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.md,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    flex: 1,
    minWidth: '45%' as any,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  typeCardActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  typeText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  typeTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  infoText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  submitBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
})

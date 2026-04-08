import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { getToken } from '@/lib/auth'
import { API_BASE } from '@/constants/api'

interface Message { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  { icon: 'analytics-outline' as const, text: 'Analyse mon portefeuille' },
  { icon: 'document-text-outline' as const, text: 'Optimiser ma fiscalité PEA' },
  { icon: 'pie-chart-outline' as const, text: 'Règle des 50/30/20' },
  { icon: 'trending-up-outline' as const, text: 'DCA sur ETF MSCI World' },
]

export default function AssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const listRef = useRef<FlatList>(null)

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', content }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setLoading(true)

    try {
      const token = await getToken()
      const res = await fetch(`${API_BASE}/api/assistant`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ messages: updated }),
      })

      if (!res.ok || !res.body) {
        setMessages(m => [...m, { role: 'assistant', content: 'Erreur lors de la réponse.' }])
        return
      }

      // Streaming
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      setMessages(m => [...m, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantContent += decoder.decode(value, { stream: true })
        setMessages(m => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: assistantContent }
          return copy
        })
        listRef.current?.scrollToEnd({ animated: true })
      }
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Impossible de joindre l\'assistant.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerIconWrap}>
            <Ionicons name="sparkles" size={20} color={colors.accent} />
          </View>
          <View>
            <Text style={s.headerTitle}>Financy Assistant</Text>
            <Text style={s.headerSub}>Propulsé par Gemini</Text>
          </View>
        </View>

        {/* ── Messages ───────────────────────────────────────────────── */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={s.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="sparkles" size={32} color={colors.accent} />
              </View>
              <Text style={s.emptyTitle}>Comment puis-je vous aider ?</Text>
              <Text style={s.emptySub}>Posez une question sur votre patrimoine</Text>
              <View style={s.suggestions}>
                {SUGGESTIONS.map(sg => (
                  <TouchableOpacity
                    key={sg.text}
                    onPress={() => send(sg.text)}
                    style={s.sugBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={sg.icon} size={14} color={colors.accent} />
                    <Text style={s.sugText}>{sg.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[
              s.bubble,
              item.role === 'user' ? s.userBubble : s.aiBubble,
            ]}>
              {item.role === 'assistant' && (
                <View style={s.aiAvatarRow}>
                  <Ionicons name="sparkles" size={10} color={colors.accent} />
                </View>
              )}
              <Text style={[
                s.bubbleText,
                { color: item.role === 'user' ? colors.background : colors.textPrimary },
              ]}>
                {item.content}
              </Text>
            </View>
          )}
        />

        {/* ── Input ──────────────────────────────────────────────────── */}
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Posez une question..."
            placeholderTextColor={colors.textMuted}
            multiline
            onSubmitEditing={() => send()}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
            onPress={() => send()}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={colors.background} size="small" />
              : <Ionicons name="arrow-up" size={18} color={colors.background} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerIconWrap: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: colors.accent + '15',
    borderWidth: 1, borderColor: colors.accent + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
  headerSub:   { color: colors.textMuted,   fontSize: fontSize.xs },

  messageList: { padding: spacing.md, gap: 10, flexGrow: 1 },

  emptyState:   { flex: 1, alignItems: 'center', paddingTop: 48 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: radius.xl,
    backgroundColor: colors.accent + '12',
    borderWidth: 1, borderColor: colors.accent + '25',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle:   { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', marginBottom: 6 },
  emptySub:     { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: 24 },
  suggestions:  { gap: 8, width: '100%' },

  sugBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  sugText: { color: colors.textSecondary, fontSize: fontSize.sm },

  bubble:     { maxWidth: '85%', borderRadius: radius.lg, padding: 12 },
  userBubble: { backgroundColor: colors.accent, alignSelf: 'flex-end' },
  aiBubble:   { backgroundColor: colors.surface, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border },
  bubbleText: { fontSize: fontSize.sm, lineHeight: 20 },

  aiAvatarRow: { marginBottom: 4 },

  inputRow: {
    flexDirection: 'row', gap: 8,
    padding: spacing.md, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth:     1,
    borderColor:     colors.border,
    borderRadius:    radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color:           colors.textPrimary,
    fontSize:        fontSize.sm,
    maxHeight:       100,
  },
  sendBtn: {
    width:           44, height: 44,
    borderRadius:    radius.full,
    backgroundColor: colors.accent,
    alignItems:      'center', justifyContent: 'center',
  },
})

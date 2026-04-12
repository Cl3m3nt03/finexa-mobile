'use client'

import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { useQueryClient } from '@tanstack/react-query'
import { colors, fontSize, radius, spacing } from '@/constants/theme'
import { apiFetch } from '@/lib/api'

interface ParsedRow {
  name: string
  isin?: string
  quantity: number
  avgBuyPrice: number
  lastPrice?: number
}

interface Props {
  visible:      boolean
  assetId:      string
  assetName:    string
  onClose:      () => void
  onViewHistory?: () => void
}

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
]

function monthLabel(month: number, year: number) {
  return `${MONTHS_FR[month - 1]} ${year}`
}

function detectDateFromFilename(name: string): { month: number; year: number } | null {
  const m1 = name.match(/(\d{2})[-\/](\d{2})[-\/](\d{4})/)
  if (m1) return { month: parseInt(m1[2]), year: parseInt(m1[3]) }
  const m2 = name.match(/(\d{4})[-\/](\d{2})[-\/](\d{2})/)
  if (m2) return { month: parseInt(m2[2]), year: parseInt(m2[1]) }
  const m3 = name.match(/(\d{2})[-\/](\d{4})/)
  if (m3) return { month: parseInt(m3[1]), year: parseInt(m3[2]) }
  const m4 = name.match(/(\d{4})[-\/](\d{2})/)
  if (m4) return { month: parseInt(m4[2]), year: parseInt(m4[1]) }
  return null
}

export function HoldingsImportModal({ visible, assetId, assetName, onClose, onViewHistory }: Props) {
  const now = new Date()
  const queryClient = useQueryClient()

  const [fileName,   setFileName]   = useState<string | null>(null)
  const [fileType,   setFileType]   = useState<'csv' | 'pdf'>('csv')
  const [preview,    setPreview]    = useState<ParsedRow[]>([])
  const [pdfRows,    setPdfRows]    = useState<ParsedRow[] | null>(null)
  const [csvText,    setCsvText]    = useState<string | null>(null)
  const [snapMonth,  setSnapMonth]  = useState(now.getMonth() + 1)
  const [snapYear,   setSnapYear]   = useState(now.getFullYear())
  const [status,     setStatus]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [resultMsg,  setResultMsg]  = useState('')

  function reset() {
    setFileName(null); setFileType('csv'); setPreview([])
    setPdfRows(null); setCsvText(null)
    setStatus('idle'); setResultMsg('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/pdf', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      await loadFile(asset.uri, asset.name ?? 'fichier')
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible d\'ouvrir le fichier')
    }
  }

  async function loadFile(uri: string, name: string) {
    reset()
    setFileName(name)
    const isPdf = /\.pdf$/i.test(name)
    setFileType(isPdf ? 'pdf' : 'csv')

    // Auto-detect date from filename
    const detected = detectDateFromFilename(name)
    if (detected && detected.month >= 1 && detected.month <= 12 && detected.year >= 2020) {
      setSnapMonth(detected.month)
      setSnapYear(detected.year)
    }

    setStatus('loading')
    setResultMsg(isPdf ? 'Analyse PDF…' : 'Lecture CSV…')

    try {
      if (isPdf) {
        // Read PDF as base64 and send to server for extraction
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
        const data = await apiFetch(`/api/assets/${assetId}/upload-pdf`, {
          method: 'POST',
          body: JSON.stringify({ pdfBase64: base64 }),
        })
        setPdfRows(data.holdings)
        setPreview(data.holdings)
        setStatus('idle')
        setResultMsg('')
      } else {
        // Read CSV as text
        const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 })
        setCsvText(text)
        setPreview(quickParseCSV(text))
        setStatus('idle')
        setResultMsg('')
      }
    } catch (err: any) {
      setStatus('error')
      setResultMsg(err.message ?? 'Erreur lecture fichier')
    }
  }

  async function handleImport() {
    if (preview.length === 0) return
    setStatus('loading')
    try {
      const label = monthLabel(snapMonth, snapYear)
      const body: Record<string, unknown> = {
        mode:          'snapshot',
        snapshotLabel: label,
        snapshotDate:  new Date(snapYear, snapMonth - 1, 1).toISOString(),
      }
      if (pdfRows) {
        body.rows       = pdfRows
        body.cumulative = true
      } else {
        body.csv = csvText
      }
      const data = await apiFetch(`/api/assets/${assetId}/import-holdings`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setResultMsg(`Snapshot "${data.snapshotLabel}" — ${data.imported} position${data.imported > 1 ? 's' : ''}`)
      setStatus('success')
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['snapshots', assetId] })
    } catch (err: any) {
      setResultMsg(err.message ?? 'Erreur import')
      setStatus('error')
    }
  }

  // Increment/decrement month
  function prevMonth() {
    if (snapMonth === 1) { setSnapMonth(12); setSnapYear(y => y - 1) }
    else setSnapMonth(m => m - 1)
  }
  function nextMonth() {
    if (snapMonth === 12) { setSnapMonth(1); setSnapYear(y => y + 1) }
    else setSnapMonth(m => m + 1)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={s.sheet}>
            <View style={s.handle} />

            {/* Header */}
            <View style={s.header}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>Import CSV / PDF</Text>
                <Text style={s.sub}>{assetName}</Text>
              </View>
              {onViewHistory && (
                <TouchableOpacity
                  style={s.histBtn}
                  onPress={() => { handleClose(); onViewHistory() }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={14} color={colors.accent} />
                  <Text style={s.histBtnTxt}>Historique</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Month selector */}
            <View style={s.monthRow}>
              <Text style={s.monthLabel}>Mois du snapshot</Text>
              <View style={s.monthPicker}>
                <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-back" size={16} color={colors.accent} />
                </TouchableOpacity>
                <Text style={s.monthValue}>{monthLabel(snapMonth, snapYear)}</Text>
                <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                </TouchableOpacity>
              </View>
            </View>

            {/* File pick zone */}
            {!fileName ? (
              <TouchableOpacity style={s.dropZone} onPress={pickFile} activeOpacity={0.7}>
                <View style={s.dropIcon}>
                  <Ionicons name="cloud-upload-outline" size={24} color={colors.accent} />
                </View>
                <Text style={s.dropTitle}>Sélectionner un fichier</Text>
                <Text style={s.dropSub}>.csv · .txt · .pdf</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.filePill}>
                <Ionicons
                  name={fileType === 'pdf' ? 'document-outline' : 'document-text-outline'}
                  size={16} color={colors.accent}
                />
                <Text style={s.filePillName} numberOfLines={1}>{fileName}</Text>
                {status === 'loading' ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={s.filePillCount}>· {preview.length} pos.</Text>
                )}
                <TouchableOpacity onPress={reset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            {/* PDF cumulative info */}
            {pdfRows && (
              <View style={s.infoBanner}>
                <Ionicons name="information-circle-outline" size={14} color={colors.accent} />
                <Text style={s.infoBannerTxt}>
                  Avis d'opération — quantités ajoutées au snapshot précédent (cumul DCA auto)
                </Text>
              </View>
            )}

            {/* Preview */}
            {preview.length > 0 && status !== 'loading' && (
              <View style={s.previewBox}>
                <Text style={s.previewTitle}>{preview.length} position{preview.length > 1 ? 's' : ''} détectée{preview.length > 1 ? 's' : ''}</Text>
                <ScrollView style={{ maxHeight: 140 }} showsVerticalScrollIndicator={false}>
                  {preview.slice(0, 8).map((row, i) => (
                    <View key={i} style={[s.previewRow, i > 0 && s.previewRowBorder]}>
                      <Text style={s.previewName} numberOfLines={1}>{row.name}</Text>
                      <Text style={s.previewQty}>{row.quantity} × {row.avgBuyPrice.toFixed(2)} €</Text>
                    </View>
                  ))}
                  {preview.length > 8 && (
                    <Text style={s.previewMore}>+{preview.length - 8} autres…</Text>
                  )}
                </ScrollView>
              </View>
            )}

            {/* Status message */}
            {status === 'success' && (
              <View style={s.successBanner}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                <Text style={s.successTxt}>{resultMsg}</Text>
              </View>
            )}
            {status === 'error' && (
              <View style={s.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={s.errorTxt}>{resultMsg}</Text>
              </View>
            )}

            {/* Actions */}
            <View style={s.actions}>
              <TouchableOpacity style={s.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
                <Text style={s.cancelTxt}>{status === 'success' ? 'Fermer' : 'Annuler'}</Text>
              </TouchableOpacity>
              {status !== 'success' && (
                <TouchableOpacity
                  style={[s.importBtn, (preview.length === 0 || status === 'loading') && { opacity: 0.4 }]}
                  onPress={handleImport}
                  disabled={preview.length === 0 || status === 'loading'}
                  activeOpacity={0.8}
                >
                  {status === 'loading' && pdfRows !== null
                    ? <ActivityIndicator size="small" color={colors.background} />
                    : <Text style={s.importTxt}>Importer</Text>
                  }
                </TouchableOpacity>
              )}
              {status === 'success' && onViewHistory && (
                <TouchableOpacity
                  style={s.histActionBtn}
                  onPress={() => { handleClose(); onViewHistory() }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="time-outline" size={14} color={colors.background} />
                  <Text style={s.importTxt}>Voir DCA</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

// ── Simple CSV parser (client-side preview only, server does the real parse) ──
function parseNumber(s: string): number {
  return parseFloat(s.replace(/\s/g, '').replace(',', '.')) || 0
}
function normStr(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
function quickParseCSV(csv: string): ParsedRow[] {
  const text = csv.replace(/^\uFEFF/, '')
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const sep = lines[0].split(';').length > lines[0].split(',').length ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.replace(/^["'\s]+|["'\s]+$/g, '').toLowerCase())
  function findCol(...candidates: string[]) {
    for (const c of candidates) {
      const idx = headers.findIndex(h => normStr(h).includes(normStr(c)))
      if (idx >= 0) return idx
    }
    return -1
  }
  const colName = findCol('libelle', 'designation', 'name', 'titre')
  const colIsin = findCol('isin')
  const colQty  = findCol('quantite', 'qte', 'quantity', 'nombre')
  const colPru  = findCol('pru', 'prix revient', 'cout moyen', 'buyingprice')
  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map(p => p.replace(/^["'\s]+|["'\s]+$/g, '').trim())
    if (parts.length < 2) continue
    const name  = colName >= 0 ? parts[colName] : parts[0]
    const qty   = colQty >= 0 ? parseNumber(parts[colQty]) : 0
    const pru   = colPru >= 0 ? parseNumber(parts[colPru]) : 0
    const rawIsin = colIsin >= 0 ? parts[colIsin] : undefined
    if (!name || normStr(name).includes('total') || qty === 0) continue
    const cleanIsin = rawIsin?.toUpperCase().replace(/\s/g, '')
    const validIsin = cleanIsin && /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(cleanIsin) ? cleanIsin : undefined
    rows.push({ name, isin: validIsin, quantity: qty, avgBuyPrice: pru })
  }
  return rows
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 36, gap: 12,
  },
  handle:  { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },

  header:    { flexDirection: 'row', alignItems: 'flex-start' },
  title:     { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700' },
  sub:       { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  histBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent + '40' },
  histBtnTxt: { color: colors.accent, fontSize: fontSize.xs, fontWeight: '600' },

  monthRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.accent + '12', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent + '25' },
  monthLabel:  { color: colors.accent, fontSize: fontSize.xs, fontWeight: '600' },
  monthPicker: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  monthValue:  { color: colors.accent, fontSize: fontSize.sm, fontWeight: '700', minWidth: 110, textAlign: 'center' },

  dropZone:  { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.xl, padding: 28, alignItems: 'center', gap: 8 },
  dropIcon:  { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.accent + '15', alignItems: 'center', justifyContent: 'center' },
  dropTitle: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  dropSub:   { color: colors.textMuted, fontSize: fontSize.xs },

  filePill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface2 ?? colors.background, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12 },
  filePillName: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '500' },
  filePillCount: { color: colors.textMuted, fontSize: fontSize.xs },

  infoBanner:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, backgroundColor: colors.accent + '12', borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent + '25' },
  infoBannerTxt: { flex: 1, color: colors.accent, fontSize: fontSize.xs, lineHeight: 16 },

  previewBox:   { backgroundColor: colors.background, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  previewTitle: { color: colors.textMuted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', padding: 8, paddingBottom: 4 },
  previewRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 7 },
  previewRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  previewName:  { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '500' },
  previewQty:   { color: colors.textMuted, fontSize: fontSize.xs, fontFamily: 'monospace' },
  previewMore:  { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.xs, padding: 6 },

  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: (colors.success ?? '#10B981') + '15', borderRadius: radius.md, borderWidth: 1, borderColor: (colors.success ?? '#10B981') + '30' },
  successTxt:    { flex: 1, color: colors.success ?? '#10B981', fontSize: fontSize.sm, fontWeight: '500' },
  errorBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.danger + '15', borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger + '30' },
  errorTxt:      { flex: 1, color: colors.danger, fontSize: fontSize.sm },

  actions:      { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn:    { flex: 1, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelTxt:    { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600' },
  importBtn:    { flex: 1, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  histActionBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  importTxt:    { color: colors.background, fontSize: fontSize.sm, fontWeight: '700' },
})

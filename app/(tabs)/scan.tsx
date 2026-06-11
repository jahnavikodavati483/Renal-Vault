import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { extractTextFromPDF, extractTextFromImage, renderPDFPageToBase64 } from '../../services/pdfExtractor';
import { extractParamsWithVision, uriToBase64 } from '../../services/visionExtractor';
import { saveReport, getReports } from '../../services/firestore';
import { getAIRecommendations } from '../../services/grokAI';
import { parseKidneyParameters, hasMinimumData, countDetected } from '../../utils/parameterParser';
import { analyzeCKD, PARAMETER_META, getStageName } from '../../utils/ckdAnalysis';
import { useAuth } from '../../hooks/useAuth';
import { LabValueRow } from '../../components/LabValueRow';
import { Button } from '../../components/ui/Button';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../constants/theme';
import { KidneyParameters, AnalysisResult, AIRecommendationResult, UrgencyLevel } from '../../types';

type Step = 'idle' | 'processing' | 'review' | 'saving' | 'results';

const SAVE_STEPS = [
  { key: 'ckd',  icon: 'analytics',  label: 'Detecting CKD stage...' },
  { key: 'ai',   icon: 'sparkles',   label: 'Getting Grok AI recommendations...' },
  { key: 'save', icon: 'cloud-upload', label: 'Saving report to cloud...' },
];

const URGENCY_CONFIG: Record<UrgencyLevel, { color: string; bg: string; icon: string; label: string }> = {
  routine:   { color: Colors.success,   bg: Colors.successLight, icon: 'checkmark-circle', label: 'Routine Check-up' },
  soon:      { color: Colors.warning,   bg: Colors.warningLight, icon: 'time',             label: 'See Doctor Soon' },
  urgent:    { color: Colors.danger,    bg: Colors.dangerLight,  icon: 'alert-circle',     label: 'Urgent Attention' },
  emergency: { color: '#7C3AED',        bg: '#F3E5F5',           icon: 'warning',          label: 'Emergency!' },
};

const MANUAL_PARAMS: Array<keyof KidneyParameters> = [
  'egfr','creatinine','bun','urea','sodium','potassium',
  'calcium','phosphorus','albumin','hemoglobin','uricAcid','bicarbonate',
];

export default function ScanScreen() {
  const { user, profile } = useAuth();

  const [step, setStep]               = useState<Step>('idle');
  const [saveStepIdx, setSaveStepIdx]   = useState(0);
  const [parameters, setParameters]   = useState<KidneyParameters>({});
  const [rawText, setRawText]         = useState('');
  const [showManual, setShowManual]   = useState(false);
  const [manualDraft, setManualDraft] = useState<Record<string, string>>({});
  const [finalAnalysis, setFinalAnalysis] = useState<AnalysisResult | null>(null);
  const [processingMsg, setProcessingMsg] = useState('Reading report...');

  const sex = profile?.sex ?? 'male';

  const [isRescan, setIsRescan] = useState(false);

  // Check for duplicate reports in history
  useEffect(() => {
    async function checkDuplicate() {
      if (!user || Object.keys(parameters).length === 0) {
        setIsRescan(false);
        return;
      }
      try {
        const existingReports = await getReports(user.uid, 20);
        const isDup = existingReports.some(r => {
          const hasSharedData =
            (parameters.egfr !== undefined && r.parameters.egfr !== undefined) ||
            (parameters.creatinine !== undefined && r.parameters.creatinine !== undefined) ||
            (parameters.bun !== undefined && r.parameters.bun !== undefined);

          if (!hasSharedData) return false;

          if (parameters.egfr !== undefined && r.parameters.egfr !== undefined && parameters.egfr !== r.parameters.egfr) return false;
          if (parameters.creatinine !== undefined && r.parameters.creatinine !== undefined && parameters.creatinine !== r.parameters.creatinine) return false;
          if (parameters.bun !== undefined && r.parameters.bun !== undefined && parameters.bun !== r.parameters.bun) return false;

          return true;
        });
        setIsRescan(isDup);
      } catch (_) {
        setIsRescan(false);
      }
    }
    checkDuplicate();
  }, [parameters, user]);

  // ── Uploads ────────────────────────────────────────────────────────────────
  async function pickPDF() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      processFile(result.assets[0].uri, 'pdf');
    } catch (_e) {
      Alert.alert('Error', 'Could not open file picker.');
    }
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission required', 'Gallery access needed.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: false, // we handle base64 ourselves via canvas for reliable resizing
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setStep('processing');
    setProcessingMsg('Preparing image…');

    // Convert blob URI to base64 immediately while the blob handle is still live
    const base64 = await uriToBase64(asset.uri);
    processFile(asset.uri, 'image', base64 || undefined, 'image/jpeg');
  }

  async function processFile(
    uri: string,
    type: 'pdf' | 'image',
    preloadedBase64?: string,
    preloadedMime?: string,
  ) {
    if (step !== 'processing') setStep('processing');
    setProcessingMsg('Reading your report…');

    try {
      // ── Step 1: Text extraction + regex (PDF only) ────────────────────────
      const text = type === 'pdf' ? await extractTextFromPDF(uri) : '';
      setRawText(text);

      let params   = parseKidneyParameters(text);
      let detected = countDetected(params);

      // ── Step 2: Vision AI ─────────────────────────────────────────────────
      // Always run vision for images. Also run for PDFs when regex got < 2 values.
      const needsVision = type === 'image' || detected < 2;

      if (needsVision) {
        setProcessingMsg('AI Vision is reading your report…');

        let base64   = preloadedBase64 ?? '';
        let mimeType = preloadedMime ?? 'image/jpeg';

        if (!base64) {
          if (type === 'image') {
            console.log('[Scan] 📸 Converting image to base64...');
            base64   = await uriToBase64(uri);
            mimeType = 'image/jpeg';
            console.log(`[Scan] ✓ Image converted: ${base64.length} chars`);
          } else {
            console.log('[Scan] 📄 Rendering PDF page to base64...');
            base64   = await renderPDFPageToBase64(uri);
            mimeType = 'image/jpeg';
            console.log(`[Scan] ✓ PDF rendered: ${base64.length} chars`);
          }
        }

        if (base64) {
          setProcessingMsg('Extracting lab values with Grok AI…');
          const result = await extractParamsWithVision(base64, mimeType);
          if (result.error) {
            Alert.alert('AI Extraction Error', result.error);
          }
          const visionParams = result.params;
          if (visionParams && countDetected(visionParams) > detected) {
            params   = visionParams;
            detected = countDetected(visionParams);
            console.log('[Scan] ✓ Vision extraction improved detection to', detected);
          } else {
            console.log('[Scan] ⚠️ Vision extraction did not improve results');
          }
        }
      }

      setParameters(params);
      setStep('review');

      // Auto-open manual entry for images when AI couldn't extract values
      if (type === 'image' && detected === 0) {
        setTimeout(() => setShowManual(true), 400);
      }
    } catch (_e) {
      Alert.alert('Processing Error', 'Could not read the file. Please enter values manually.');
      setStep('review');
      setTimeout(() => setShowManual(true), 300);
    }
  }

  // ── Analyze & Save ─────────────────────────────────────────────────────────
  async function runAnalysis() {
    if (!hasMinimumData(parameters)) {
      Alert.alert('Insufficient Data', 'Please enter at least eGFR, Creatinine, BUN, or Urea to proceed.');
      return;
    }

    // If not logged in, still show analysis — just won't save to cloud
    const effectiveProfile = profile ?? { age: 40, sex: 'male' as const };

    setStep('saving');
    setSaveStepIdx(0);

    try {
      // Step 1 — CKD Detection (always works, local computation)
      const analysis = analyzeCKD(parameters, effectiveProfile);
      setSaveStepIdx(1);

      // Step 2 — AI Recommendations (always returns something, instant local fallback)
      const aiInsights = await getAIRecommendations(parameters, analysis, effectiveProfile);
      analysis.aiInsights = aiInsights;
      setSaveStepIdx(2);

      // Step 3 — Save to Firestore
      if (user) {
        try {
          await saveReport(user.uid, {
            userId: user.uid,
            date: new Date().toISOString(),
            rawText,
            parameters,
            analysis,
            isDuplicate: isRescan,
            createdAt: new Date().toISOString(),
          });
        } catch (saveErr: any) {
          console.error('[RenalVault] Firestore save failed:', saveErr);
          Alert.alert(
            'Save Failed',
            `Your analysis is shown below but could not be saved to the dashboard: ${saveErr?.message ?? 'Permission denied'}. Make sure you are logged in.`,
          );
        }
      } else {
        Alert.alert('Not Logged In', 'Sign in to save your results to the dashboard.');
      }

      // Always show results — even if save failed
      setFinalAnalysis(analysis);
      setStep('results');
    } catch (e: any) {
      console.error('[RenalVault] runAnalysis error:', e);
      Alert.alert('Analysis Failed', e.message ?? 'Something went wrong. Please try again.');
      setStep('review');
    }
  }

  function applyManual() {
    const updated = { ...parameters };
    for (const key of MANUAL_PARAMS) {
      const v = parseFloat(manualDraft[key] ?? '');
      if (!isNaN(v) && v > 0) (updated as any)[key] = v;
    }
    setParameters(updated);
    setShowManual(false);
  }

  function reset() {
    setStep('idle');
    setSaveStepIdx(0);
    setParameters({});
    setRawText('');
    setManualDraft({});
    setFinalAnalysis(null);
    setShowManual(false);
    setIsRescan(false);
  }

  function updateParam(key: keyof KidneyParameters, value: number) {
    setParameters(prev => ({ ...prev, [key]: value }));
  }

  const numericKeys = (Object.keys(parameters) as Array<keyof KidneyParameters>)
    .filter(k => typeof parameters[k] === 'number');

  // ── RESULTS SCREEN ────────────────────────────────────────────────────────
  if (step === 'results' && finalAnalysis) {
    const ai = finalAnalysis.aiInsights;
    const urgency = ai ? URGENCY_CONFIG[ai.urgency] : null;

    return (
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Success header */}
        <LinearGradient colors={[Colors.success, '#2ECC71']} style={styles.resultsHeader}>
          <View style={styles.resultsCheckCircle}>
            <Ionicons name="checkmark" size={36} color={Colors.white} />
          </View>
          <Text style={styles.resultsHeaderTitle}>Analysis Complete!</Text>
          <Text style={styles.resultsHeaderSub}>CKD Stage {finalAnalysis.ckdStage ?? '—'} · Risk Score {finalAnalysis.riskScore}/100</Text>
        </LinearGradient>

        <View style={styles.resultsBody}>
          {isRescan && (
            <View style={styles.rescanResultBanner}>
              <View style={styles.rescanBadge}>
                <Ionicons name="copy" size={14} color="#C2410C" />
                <Text style={styles.rescanBadgeText}>SECOND COPY / RE-SCAN</Text>
              </View>
              <Text style={styles.rescanResultText}>
                This report matches an existing report in your history.
              </Text>
            </View>
          )}

          {/* CKD Detection card */}
          <View style={styles.resultsCKDCard}>
            <View style={styles.resultsCKDRow}>
              <View style={styles.resultsCKDItem}>
                <Text style={styles.resultsCKDLabel}>CKD Stage</Text>
                <Text style={styles.resultsCKDValue}>
                  {finalAnalysis.ckdStage ? `G${finalAnalysis.ckdStage}` : '—'}
                </Text>
              </View>
              <View style={styles.resultsCKDDivider} />
              <View style={styles.resultsCKDItem}>
                <Text style={styles.resultsCKDLabel}>Risk Score</Text>
                <Text style={[styles.resultsCKDValue, { color: Colors.riskLevel[finalAnalysis.riskLevel] }]}>
                  {finalAnalysis.riskScore}/100
                </Text>
              </View>
              <View style={styles.resultsCKDDivider} />
              <View style={styles.resultsCKDItem}>
                <Text style={styles.resultsCKDLabel}>eGFR</Text>
                <Text style={styles.resultsCKDValue}>
                  {parameters.egfr?.toFixed(0) ?? finalAnalysis.estimatedEgfr?.toFixed(0) ?? '—'}
                </Text>
              </View>
            </View>
            {finalAnalysis.ckdStage && (
              <Text style={styles.resultsStageName}>{getStageName(finalAnalysis.ckdStage)}</Text>
            )}
          </View>

          {/* Urgency banner */}
          {urgency && ai && (
            <View style={[styles.urgencyBanner, { backgroundColor: urgency.bg }]}>
              <Ionicons name={urgency.icon as any} size={22} color={urgency.color} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.urgencyLabel, { color: urgency.color }]}>{urgency.label}</Text>
                <Text style={[styles.urgencyMsg, { color: urgency.color }]}>{ai.urgencyMessage}</Text>
              </View>
            </View>
          )}

          {/* AI Summary */}
          {ai && (
            <>
              <View style={styles.aiSection}>
                <View style={styles.aiSectionHeader}>
                  <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.aiIconBg}>
                    <Ionicons name="sparkles" size={14} color="#FFD700" />
                  </LinearGradient>
                  <Text style={styles.aiSectionTitle}>Grok AI Summary</Text>
                </View>
                <Text style={styles.aiSummary}>{ai.summary}</Text>
              </View>

              {/* Recommendations */}
              <AIBlock title="Medical Recommendations" icon="medkit" color={Colors.primary} items={ai.recommendations} />

              {/* Dietary Advice */}
              <AIBlock title="Dietary Advice" icon="nutrition" color={Colors.success} items={ai.dietaryAdvice} />

              {/* Lifestyle */}
              <AIBlock title="Lifestyle Tips" icon="bicycle" color="#7C3AED" items={ai.lifestyle} />

              {/* Follow-up */}
              <View style={styles.followUpCard}>
                <Ionicons name="calendar" size={20} color={Colors.primary} />
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Text style={styles.followUpLabel}>Recommended Follow-up</Text>
                  <Text style={styles.followUpValue}>{ai.followUp}</Text>
                </View>
              </View>
            </>
          )}

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            This analysis is for informational purposes only. Always consult a qualified nephrologist for medical advice. Powered by Grok AI (xAI).
          </Text>

          {/* Actions */}
          <Button
            title="View Full Dashboard"
            onPress={() => { reset(); router.push('/(tabs)/dashboard'); }}
            fullWidth size="lg" style={styles.dashboardBtn}
          />
          <Button
            title="Scan Another Report"
            variant="outline"
            onPress={reset}
            fullWidth style={styles.scanAnotherBtn}
          />
        </View>
      </ScrollView>
    );
  }

  // ── SAVING / PROCESSING SCREEN ─────────────────────────────────────────────
  if (step === 'processing' || step === 'saving') {
    const isSaving = step === 'saving';
    return (
      <View style={styles.processingContainer}>
        <View style={styles.processingCard}>
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: Spacing.lg }} />
          <Text style={styles.processingTitle}>
            {isSaving ? 'Analyzing your report…' : processingMsg}
          </Text>

          {isSaving && (
            <View style={styles.stepsContainer}>
              {SAVE_STEPS.map((s, i) => {
                const done = i < saveStepIdx;
                const active = i === saveStepIdx;
                return (
                  <View key={s.key} style={styles.stepRow}>
                    <View style={[
                      styles.stepIconBg,
                      done   && { backgroundColor: Colors.success },
                      active && { backgroundColor: Colors.primary },
                      !done && !active && { backgroundColor: Colors.border },
                    ]}>
                      <Ionicons
                        name={done ? 'checkmark' : s.icon as any}
                        size={16}
                        color={done || active ? Colors.white : Colors.textMuted}
                      />
                    </View>
                    <Text style={[
                      styles.stepLabel,
                      active && { color: Colors.primary, fontWeight: '700' },
                      done   && { color: Colors.success },
                    ]}>
                      {s.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {!isSaving && (
            <Text style={styles.processingMsg}>
              {processingMsg.includes('Vision')
                ? 'AI Vision is reading the report image…'
                : 'Extracting lab values from your file…'}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // ── REVIEW SCREEN ──────────────────────────────────────────────────────────
  if (step === 'review') {
    const detectedCount = countDetected(parameters);
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.reviewHeader}>
          <TouchableOpacity onPress={reset} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.reviewTitle}>Review Lab Values</Text>
            <Text style={styles.reviewSub}>{detectedCount} value{detectedCount !== 1 ? 's' : ''} detected</Text>
          </View>
          <TouchableOpacity onPress={() => setShowManual(true)} style={styles.iconBtn}>
            <Ionicons name="create-outline" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.reviewBody} showsVerticalScrollIndicator={false}>
          {/* Detection status */}
          <View style={[styles.detectionBanner,
            { backgroundColor: detectedCount > 0 ? Colors.successLight : Colors.warningLight }
          ]}>
            <Ionicons
              name={detectedCount > 0 ? 'checkmark-circle' : 'alert-circle'}
              size={18}
              color={detectedCount > 0 ? Colors.success : Colors.warning}
            />
            <Text style={[styles.detectionText,
              { color: detectedCount > 0 ? Colors.success : Colors.warning }
            ]}>
              {detectedCount > 0
                ? `${detectedCount} parameter${detectedCount > 1 ? 's' : ''} auto-detected`
                : 'No values detected — please enter manually'}
            </Text>
          </View>

          {/* Duplicate warning */}
          {isRescan && (
            <View style={styles.duplicateWarningBanner}>
              <Ionicons name="copy-outline" size={18} color="#C2410C" style={{ marginTop: 1 }} />
              <Text style={styles.duplicateWarningText}>
                Note: This matches an existing report in your history (Duplicate Scan).
              </Text>
            </View>
          )}

          {/* Lab table */}
          {numericKeys.length > 0 && (
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHCell, { flex: 1 }]}>TEST</Text>
                <Text style={[styles.tableHCell, { width: 80, textAlign: 'right' }]}>VALUE</Text>
                <Text style={[styles.tableHCell, { width: 70, textAlign: 'center' }]}>STATUS</Text>
                <Text style={[styles.tableHCell, { width: 30 }]} />
              </View>
              {numericKeys.map(key => (
                <LabValueRow key={key} paramKey={key} value={parameters[key] as number} sex={sex} onEdit={updateParam} />
              ))}
              {parameters.ckdCategory && (
                <View style={styles.catRow}>
                  <Ionicons name="information-circle" size={14} color={Colors.primary} />
                  <Text style={styles.catText}>
                    eGFR Category: <Text style={{ fontWeight: '700', color: Colors.primary }}>{parameters.ckdCategory}</Text>
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Add more / manual */}
          <TouchableOpacity style={styles.addMoreBtn} onPress={() => setShowManual(true)} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.addMoreText}>
              {numericKeys.length > 0 ? 'Edit or add more values' : 'Enter values manually'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Analyze button */}
          <TouchableOpacity
            style={[styles.analyzeBtn, !hasMinimumData(parameters) && styles.analyzeBtnDisabled]}
            onPress={runAnalysis}
            activeOpacity={0.85}
            disabled={!hasMinimumData(parameters)}
          >
            <LinearGradient
              colors={hasMinimumData(parameters) ? [Colors.primary, Colors.primaryLight] : [Colors.border, Colors.border]}
              style={styles.analyzeBtnGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Ionicons name="sparkles" size={20} color={hasMinimumData(parameters) ? '#FFD700' : Colors.textMuted} />
              <Text style={[styles.analyzeBtnText, !hasMinimumData(parameters) && { color: Colors.textMuted }]}>
                Analyze & Get AI Insights
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Results are informational only. Always consult a nephrologist.
          </Text>
        </ScrollView>

        {/* Manual entry modal */}
        <Modal visible={showManual} animationType="slide" presentationStyle="pageSheet">
          <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Lab Values</Text>
              <TouchableOpacity onPress={() => setShowManual(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalSub}>Enter values directly from your KFT report. Leave blank to skip.</Text>
              {MANUAL_PARAMS.map(key => {
                const meta = PARAMETER_META[key];
                if (!meta) return null;
                return (
                  <View key={key} style={styles.manualField}>
                    <Text style={styles.manualLabel}>
                      {meta.label} <Text style={styles.manualUnit}>({meta.unit})</Text>
                    </Text>
                    <TextInput
                      style={styles.manualInput}
                      placeholder={`e.g. ${key === 'egfr' ? '87.08' : key === 'creatinine' ? '1.17' : '—'}`}
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="decimal-pad"
                      value={manualDraft[key] ?? (parameters[key]?.toString() ?? '')}
                      onChangeText={v => setManualDraft(p => ({ ...p, [key]: v }))}
                    />
                  </View>
                );
              })}
              <Button title="Apply Values" onPress={applyManual} fullWidth style={{ marginTop: Spacing.md }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // ── IDLE SCREEN ────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.header}>
        <Text style={styles.headerTitle}>Upload Lab Report</Text>
        <Text style={styles.headerSub}>PDF or image · Auto-extract · Grok AI analysis</Text>
      </LinearGradient>

      <View style={styles.uploadSection}>
        <TouchableOpacity style={styles.uploadCard} onPress={pickPDF} activeOpacity={0.85}>
          <LinearGradient colors={['#CCFBF1', '#99F6E4']} style={styles.uploadGrad}>
            <View style={[styles.uploadIconBg, { backgroundColor: 'rgba(20,184,166,0.15)' }]}>
              <Ionicons name="document-text" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.uploadTitle}>Upload PDF Report</Text>
            <Text style={styles.uploadSub}>KFT, LFT, CBC — any kidney lab report</Text>
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>RECOMMENDED</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadCard} onPress={pickImage} activeOpacity={0.85}>
          <LinearGradient colors={['#F3E5F5', '#E1BEE7']} style={styles.uploadGrad}>
            <View style={[styles.uploadIconBg, { backgroundColor: 'rgba(106,27,154,0.1)' }]}>
              <Ionicons name="image" size={40} color="#7C3AED" />
            </View>
            <Text style={styles.uploadTitle}>Upload Image</Text>
            <Text style={styles.uploadSub}>Photo of your lab report</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.manualEntryRow}
        onPress={() => { setStep('review'); setShowManual(true); }}
        activeOpacity={0.8}
      >
        <Ionicons name="pencil" size={18} color={Colors.primary} />
        <Text style={styles.manualEntryText}>Enter lab values manually</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      {/* How it works */}
      <View style={styles.howCard}>
        <Text style={styles.howTitle}>What Happens After Upload</Text>
        {[
          { n: '1', icon: 'document-text',  t: 'AI reads your PDF and extracts all kidney parameters' },
          { n: '2', icon: 'analytics',      t: 'CKD stage detected using KDIGO criteria + CKD-EPI formula' },
          { n: '3', icon: 'sparkles',       t: 'Grok AI generates personalized recommendations for you' },
          { n: '4', icon: 'bar-chart',      t: 'Results saved to dashboard and health history' },
        ].map(s => (
          <View key={s.n} style={styles.howRow}>
            <View style={styles.howNum}>
              <Ionicons name={s.icon as any} size={16} color={Colors.white} />
            </View>
            <Text style={styles.howText}>{s.t}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AIBlock({ title, icon, color, items }: { title: string; icon: string; color: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <View style={aiBlockStyles.card}>
      <View style={aiBlockStyles.header}>
        <View style={[aiBlockStyles.iconBg, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon as any} size={16} color={color} />
        </View>
        <Text style={aiBlockStyles.title}>{title}</Text>
      </View>
      {items.map((item, i) => (
        <View key={i} style={aiBlockStyles.row}>
          <View style={[aiBlockStyles.dot, { backgroundColor: color }]} />
          <Text style={aiBlockStyles.text}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const aiBlockStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  iconBg: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.headlineSmall, color: Colors.text, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 7 },
  text: { ...Typography.bodyMedium, color: Colors.text, flex: 1, lineHeight: 22 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: { paddingTop: 64, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
  headerTitle: { ...Typography.displayMedium, color: Colors.white, fontWeight: '800' },
  headerSub: { ...Typography.bodyMedium, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  uploadSection: { padding: Spacing.md, gap: Spacing.md },
  uploadCard: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.md },
  uploadGrad: { padding: Spacing.xl, alignItems: 'center' },
  uploadIconBg: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  uploadTitle: { ...Typography.headlineMedium, color: Colors.text, fontWeight: '700' },
  uploadSub: { ...Typography.bodyMedium, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  recommendedBadge: {
    marginTop: Spacing.md, backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.full,
  },
  recommendedText: { ...Typography.labelSmall, color: Colors.white, fontWeight: '800', letterSpacing: 1 },

  manualEntryRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    padding: Spacing.md, backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  manualEntryText: { ...Typography.bodyMedium, color: Colors.primary, flex: 1, fontWeight: '600' },

  howCard: {
    margin: Spacing.md, backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: Spacing.lg, ...Shadow.sm,
  },
  howTitle: { ...Typography.headlineSmall, color: Colors.text, fontWeight: '700', marginBottom: Spacing.md },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  howNum: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  howText: { ...Typography.bodyMedium, color: Colors.text, flex: 1, lineHeight: 22 },

  // Processing / Saving
  processingContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, padding: Spacing.lg,
  },
  processingCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.xl, width: '100%', alignItems: 'center',
    ...Shadow.lg,
  },
  processingTitle: { ...Typography.headlineLarge, color: Colors.text, fontWeight: '800' },
  processingMsg: { ...Typography.bodyMedium, color: Colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' },
  stepsContainer: { marginTop: Spacing.lg, width: '100%', gap: Spacing.md },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepIconBg: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  stepLabel: { ...Typography.bodyMedium, color: Colors.textSecondary, flex: 1 },

  // Review
  reviewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  reviewTitle: { ...Typography.headlineMedium, color: Colors.text, fontWeight: '700' },
  reviewSub: { ...Typography.bodySmall, color: Colors.textSecondary },
  reviewBody: { flex: 1, backgroundColor: Colors.background },

  detectionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    margin: Spacing.md, padding: Spacing.md, borderRadius: Radius.md,
  },
  detectionText: { ...Typography.bodySmall, flex: 1, fontWeight: '600' },

  tableCard: {
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    overflow: 'hidden', ...Shadow.sm,
  },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primary, gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md,
  },
  tableHCell: { ...Typography.labelSmall, color: 'rgba(255,255,255,0.9)', fontWeight: '700', letterSpacing: 0.5 },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.md, backgroundColor: Colors.primarySurface,
  },
  catText: { ...Typography.bodySmall, color: Colors.textSecondary },

  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    padding: Spacing.md, backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  addMoreText: { ...Typography.bodyMedium, color: Colors.primary, flex: 1, fontWeight: '600' },

  analyzeBtn: { marginHorizontal: Spacing.md, marginTop: Spacing.sm, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.md },
  analyzeBtnDisabled: { opacity: 0.5 },
  analyzeBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md + 2, paddingHorizontal: Spacing.xl,
  },
  analyzeBtnText: { ...Typography.headlineSmall, color: Colors.white, fontWeight: '800' },

  disclaimer: {
    ...Typography.bodySmall, color: Colors.textMuted,
    textAlign: 'center', padding: Spacing.lg, lineHeight: 18,
  },

  // Modal
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, paddingTop: Spacing.xl,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface,
  },
  modalTitle: { ...Typography.headlineMedium, color: Colors.text, fontWeight: '700' },
  modalBody: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  modalSub: { ...Typography.bodyMedium, color: Colors.textSecondary, marginBottom: Spacing.lg },
  manualField: { marginBottom: Spacing.md },
  manualLabel: { ...Typography.labelLarge, color: Colors.text, marginBottom: Spacing.xs },
  manualUnit: { color: Colors.textMuted, fontWeight: '400' },
  manualInput: {
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    ...Typography.bodyLarge, color: Colors.text,
  },

  // Results
  resultsHeader: {
    paddingTop: 64, paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg, alignItems: 'center',
  },
  resultsCheckCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  resultsHeaderTitle: { ...Typography.displayMedium, color: Colors.white, fontWeight: '800' },
  resultsHeaderSub: { ...Typography.bodyMedium, color: 'rgba(255,255,255,0.85)', marginTop: 4 },

  resultsBody: { padding: Spacing.md, gap: Spacing.md },

  resultsCKDCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.lg, ...Shadow.md,
  },
  resultsCKDRow: { flexDirection: 'row', alignItems: 'center' },
  resultsCKDItem: { flex: 1, alignItems: 'center' },
  resultsCKDLabel: { ...Typography.bodySmall, color: Colors.textMuted },
  resultsCKDValue: { ...Typography.headlineLarge, color: Colors.text, fontWeight: '800', marginTop: 4 },
  resultsCKDDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  resultsStageName: {
    ...Typography.bodyMedium, color: Colors.textSecondary, textAlign: 'center',
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },

  urgencyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.md,
  },
  urgencyLabel: { ...Typography.labelLarge, fontWeight: '800' },
  urgencyMsg: { ...Typography.bodyMedium, marginTop: 2 },

  aiSection: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, ...Shadow.sm,
  },
  aiSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  aiIconBg: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  aiSectionTitle: { ...Typography.headlineSmall, color: Colors.text, fontWeight: '700' },
  aiSummary: { ...Typography.bodyMedium, color: Colors.text, lineHeight: 24 },

  followUpCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primarySurface, padding: Spacing.md, borderRadius: Radius.md,
  },
  followUpLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
  followUpValue: { ...Typography.headlineSmall, color: Colors.primary, fontWeight: '700' },

  dashboardBtn: { marginTop: Spacing.sm },
  scanAnotherBtn: { marginTop: Spacing.sm, marginBottom: Spacing.xl },
  duplicateWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: '#FFEDD5',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  duplicateWarningText: {
    fontSize: 13,
    color: '#C2410C',
    fontWeight: '600',
    flex: 1,
  },
  rescanResultBanner: {
    backgroundColor: '#FFEDD5',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FED7AA',
    gap: 4,
  },
  rescanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rescanBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.5,
  },
  rescanResultText: {
    fontSize: 13,
    color: '#9A3412',
    lineHeight: 18,
  },
});

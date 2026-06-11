import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { useReports } from '../../hooks/useReports';
import { TrendChart } from '../../components/TrendChart';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../constants/theme';
import { KidneyParameters, RiskLevel, ChartDataPoint, Report } from '../../types';
import { getParameterStatus, getParameterRange, PARAMETER_META } from '../../utils/ckdAnalysis';

// Parameters to show in the chart selector
const CHART_PARAMS: Array<{ key: keyof KidneyParameters; label: string; color: string }> = [
  { key: 'egfr',        label: 'eGFR',        color: Colors.primary },
  { key: 'creatinine',  label: 'Creatinine',  color: Colors.danger },
  { key: 'bun',         label: 'BUN',         color: Colors.warning },
  { key: 'potassium',   label: 'Potassium',   color: '#7C3AED' },
  { key: 'urea',        label: 'Urea',        color: '#0891B2' },
  { key: 'sodium',      label: 'Sodium',      color: '#059669' },
];

// All parameters shown inside a report card
const CARD_PARAMS: Array<keyof KidneyParameters> = [
  'egfr', 'creatinine', 'bun', 'urea',
  'potassium', 'sodium', 'calcium', 'uricAcid',
  'phosphorus', 'albumin', 'hemoglobin',
];

const RISK_COLORS: Record<RiskLevel, string> = {
  low:      Colors.success,
  moderate: Colors.warning,
  high:     Colors.danger,
  critical: '#7C3AED',
};

const STATUS_COLOR = {
  normal: Colors.success,
  high:   Colors.danger,
  low:    Colors.warning,
};

export default function HistoryScreen() {
  const { user, profile } = useAuth();
  const { reports, loading, refresh } = useReports(user?.uid);
  const [activeChart, setActiveChart] = useState<keyof KidneyParameters>('egfr');
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  const sex = profile?.sex ?? 'male';

  function getChartData(key: keyof KidneyParameters): ChartDataPoint[] {
    return [...reports]
      .reverse()
      .filter(r => typeof r.parameters[key] === 'number')
      .map(r => ({ date: r.createdAt, value: r.parameters[key] as number }));
  }

  // Auto-select first tab that has data
  const paramsWithData = CHART_PARAMS.filter(p => getChartData(p.key).length > 0);

  const activeParam  = CHART_PARAMS.find(p => p.key === activeChart)
                    ?? paramsWithData[0]
                    ?? CHART_PARAMS[0];
  const chartData    = getChartData(activeParam.key);
  const range        = getParameterRange(activeParam.key, sex);
  const meta         = PARAMETER_META[activeParam.key];
  const currentValue = chartData.length > 0 ? chartData[chartData.length - 1].value : null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.header}>
        <Text style={styles.headerTitle}>Health History</Text>
        <Text style={styles.headerSub}>{reports.length} report{reports.length !== 1 ? 's' : ''} recorded</Text>
      </LinearGradient>

      {loading && reports.length === 0 && (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      )}

      {!loading && reports.length === 0 && (
        <View style={styles.emptyBox}>
          <Ionicons name="bar-chart-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Reports Yet</Text>
          <Text style={styles.emptySub}>Upload your first lab report to start tracking trends.</Text>
        </View>
      )}

      {reports.length > 0 && (
        <>
          {/* ── Only show tabs for parameters present in reports ─────── */}
          {paramsWithData.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
              {paramsWithData.map(p => {
                const active = activeParam.key === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.tab, active && { borderBottomColor: p.color, borderBottomWidth: 3 }]}
                    onPress={() => setActiveChart(p.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tabText, active && { color: p.color, fontWeight: '700' }]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* ── Current value display ──────────────────────────────────── */}
          {currentValue !== null && meta && (
            <View style={styles.currentCard}>
              <View style={styles.currentLeft}>
                <Text style={styles.currentLabel}>Latest {meta.label}</Text>
                {range && (
                  <Text style={styles.currentRange}>
                    Normal: {range.min}–{range.max} {meta.unit}
                  </Text>
                )}
              </View>
              <View style={styles.currentRight}>
                {(() => {
                  const st = getParameterStatus(activeChart, currentValue, sex);
                  const color = STATUS_COLOR[st];
                  return (
                    <>
                      <Text style={[styles.currentValue, { color }]}>
                        {Number.isInteger(currentValue) ? currentValue : currentValue.toFixed(2)}
                      </Text>
                      <Text style={styles.currentUnit}>{meta.unit}</Text>
                      <View style={[styles.currentBadge, { backgroundColor: color + '18' }]}>
                        <Ionicons
                          name={st === 'normal' ? 'checkmark-circle' : st === 'high' ? 'arrow-up-circle' : 'arrow-down-circle'}
                          size={12} color={color}
                        />
                        <Text style={[styles.currentBadgeText, { color }]}>
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </Text>
                      </View>
                    </>
                  );
                })()}
              </View>
            </View>
          )}

          {/* ── Reference range bar (single report) ───────────────────── */}
          {currentValue !== null && range && (
            <View style={styles.rangeBarCard}>
              <Text style={styles.rangeBarLabel}>Position in reference range</Text>
              <RangeBar value={currentValue} min={range.min} max={range.max} color={activeParam.color} />
            </View>
          )}

          {/* ── Trend chart (2+ reports) ───────────────────────────────── */}
          {chartData.length >= 2 && (
            <View style={styles.chartCard}>
              <TrendChart
                title={meta?.label ?? activeParam.label}
                unit={meta?.unit ?? ''}
                data={chartData}
                color={activeParam.color}
                normalMin={range?.min}
                normalMax={range?.max}
              />
            </View>
          )}

          {chartData.length === 1 && (
            <View style={styles.oneReportNote}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.oneReportText}>
                Scan a second report to see your {meta?.label} trend over time.
              </Text>
            </View>
          )}

          {/* ── All Reports list ───────────────────────────────────────── */}
          <Text style={styles.listTitle}>All Reports</Text>

          {reports.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              sex={sex}
              expanded={expandedId === report.id}
              onToggle={() => setExpandedId(expandedId === report.id ? null : (report.id ?? null))}
            />
          ))}

          <View style={{ height: Spacing.xl }} />
        </>
      )}
    </ScrollView>
  );
}

// ── Range bar component ──────────────────────────────────────────────────────
function RangeBar({ value, min, max, color }: { value: number; min: number; max: number; color: string }) {
  const extended = (max - min) * 0.3;
  const rangeMin = Math.max(0, min - extended);
  const rangeMax = max + extended;
  const total = rangeMax - rangeMin;
  const pct = Math.min(100, Math.max(0, ((value - rangeMin) / total) * 100));
  const normalStartPct = ((min - rangeMin) / total) * 100;
  const normalWidthPct = ((max - min) / total) * 100;

  return (
    <View style={rbs.container}>
      <View style={rbs.track}>
        {/* Normal zone */}
        <View style={[rbs.normalZone, { left: `${normalStartPct}%`, width: `${normalWidthPct}%` }]} />
        {/* Marker */}
        <View style={[rbs.marker, { left: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={rbs.labels}>
        <Text style={rbs.labelText}>{min}</Text>
        <Text style={[rbs.labelCenter, { color }]}>▲ {value}</Text>
        <Text style={rbs.labelText}>{max}</Text>
      </View>
    </View>
  );
}

const rbs = StyleSheet.create({
  container: { marginTop: Spacing.sm },
  track: {
    height: 10, backgroundColor: '#F1F5F9',
    borderRadius: 5, marginHorizontal: Spacing.md,
    position: 'relative', overflow: 'visible',
  },
  normalZone: {
    position: 'absolute', height: '100%',
    backgroundColor: Colors.success + '30',
    borderRadius: 5,
  },
  marker: {
    position: 'absolute', width: 14, height: 14,
    borderRadius: 7, top: -2,
    marginLeft: -7,
    borderWidth: 2, borderColor: Colors.white,
    ...Shadow.sm,
  },
  labels: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, marginTop: Spacing.sm,
  },
  labelText: { ...Typography.bodySmall, color: Colors.textMuted },
  labelCenter: { ...Typography.labelMedium, fontWeight: '700' },
});

// ── Report card ─────────────────────────────────────────────────────────────
function ReportCard({
  report, sex, expanded, onToggle,
}: {
  report: Report;
  sex: 'male' | 'female';
  expanded: boolean;
  onToggle: () => void;
}) {
  const rc = RISK_COLORS[report.analysis.riskLevel];
  const params = CARD_PARAMS.filter(k => typeof report.parameters[k] === 'number');

  return (
    <TouchableOpacity style={styles.reportCard} onPress={onToggle} activeOpacity={0.9}>
      {/* Top row */}
      <View style={styles.reportCardTop}>
        <View>
          <Text style={styles.reportDate}>{format(new Date(report.createdAt), 'MMMM d, yyyy')}</Text>
          <Text style={styles.reportTime}>{format(new Date(report.createdAt), 'h:mm a')}</Text>
        </View>
        <View style={styles.reportRight}>
          {report.isDuplicate && (
            <View style={styles.duplicateBadge}>
              <Ionicons name="copy-outline" size={10} color="#C2410C" />
              <Text style={styles.duplicateBadgeText}>2nd Copy</Text>
            </View>
          )}
          <View style={[styles.riskBadge, { backgroundColor: rc + '18' }]}>
            <Text style={[styles.riskBadgeText, { color: rc }]}>
              {report.analysis.riskLevel.toUpperCase()}
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18} color={Colors.textMuted}
            style={{ marginLeft: Spacing.sm }}
          />
        </View>
      </View>

      {/* Quick stats row */}
      <View style={styles.quickRow}>
        {(['egfr', 'creatinine', 'bun', 'potassium'] as Array<keyof KidneyParameters>).map(key => {
          const val = report.parameters[key];
          if (typeof val !== 'number') return null;
          const meta = PARAMETER_META[key];
          if (!meta) return null;
          const st = getParameterStatus(key, val, sex);
          const color = STATUS_COLOR[st];
          return (
            <View key={key} style={styles.quickStat}>
              <Text style={styles.quickStatLabel}>
                {key === 'egfr' ? 'eGFR' : key === 'creatinine' ? 'Creat.' : key === 'bun' ? 'BUN' : 'K⁺'}
              </Text>
              <Text style={[styles.quickStatValue, { color }]}>
                {Number.isInteger(val) ? val : val.toFixed(1)}
              </Text>
              <Text style={styles.quickStatUnit}>{meta.unit}</Text>
              <View style={[styles.quickDot, { backgroundColor: color }]} />
            </View>
          );
        })}
        {report.analysis.ckdStage && (
          <View style={[styles.quickStat, { backgroundColor: Colors.primarySurface }]}>
            <Text style={styles.quickStatLabel}>Stage</Text>
            <Text style={[styles.quickStatValue, { color: Colors.primary }]}>
              G{report.analysis.ckdStage}
            </Text>
          </View>
        )}
      </View>

      {/* Risk score bar */}
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>Risk Score</Text>
        <View style={styles.scoreBarBg}>
          <View style={[styles.scoreBarFill, { width: `${report.analysis.riskScore}%`, backgroundColor: rc }]} />
        </View>
        <Text style={[styles.scoreValue, { color: rc }]}>{report.analysis.riskScore}</Text>
      </View>

      {/* Expanded: all parameters table */}
      {expanded && params.length > 0 && (
        <View style={styles.expandedSection}>
          <Text style={styles.expandedTitle}>All Detected Parameters</Text>

          {/* Table header */}
          <View style={styles.tableHead}>
            <Text style={[styles.thCell, { flex: 1 }]}>TEST</Text>
            <Text style={[styles.thCell, { width: 72, textAlign: 'right' }]}>VALUE</Text>
            <Text style={[styles.thCell, { width: 60, textAlign: 'center' }]}>STATUS</Text>
            <Text style={[styles.thCell, { width: 90, textAlign: 'right' }]}>REFERENCE</Text>
          </View>

          {params.map(key => {
            const val = report.parameters[key] as number;
            const meta = PARAMETER_META[key];
            if (!meta) return null;
            const st = getParameterStatus(key, val, sex);
            const color = STATUS_COLOR[st];
            const rng = getParameterRange(key, sex);
            return (
              <View key={key} style={[styles.tableRow, st !== 'normal' && { backgroundColor: color + '08' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paramName}>{meta.label}</Text>
                  <Text style={styles.paramUnit}>{meta.unit}</Text>
                </View>
                <Text style={[styles.paramValue, { color }]}>
                  {Number.isInteger(val) ? val : val.toFixed(2)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: color + '18', width: 60 }]}>
                  <Ionicons
                    name={st === 'normal' ? 'checkmark-circle' : st === 'high' ? 'arrow-up-circle' : 'arrow-down-circle'}
                    size={11} color={color}
                  />
                  <Text style={[styles.statusText, { color }]}>
                    {st === 'normal' ? 'OK' : st.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.refText}>
                  {rng ? `${rng.min}–${rng.max}` : '—'}
                </Text>
              </View>
            );
          })}

          {/* AI summary if available */}
          {report.analysis.aiInsights?.summary && (
            <View style={styles.aiSummaryBox}>
              <View style={styles.aiSummaryHeader}>
                <Ionicons name="sparkles" size={14} color="#FFD700" />
                <Text style={styles.aiSummaryTitle}>Grok AI Summary</Text>
              </View>
              <Text style={styles.aiSummaryText}>{report.analysis.aiInsights.summary}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: { paddingTop: 64, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  headerTitle: { ...Typography.headlineLarge, color: Colors.white, fontWeight: '800' },
  headerSub: { ...Typography.bodyMedium, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  emptyBox: { alignItems: 'center', padding: Spacing.xxl },
  emptyTitle: { ...Typography.headlineMedium, color: Colors.text, marginTop: Spacing.md },
  emptySub: { ...Typography.bodyMedium, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs },

  // Chart tabs
  tabScroll: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: {
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md + 4,
    alignItems: 'center', borderBottomColor: 'transparent', borderBottomWidth: 3,
  },
  tabText: { ...Typography.labelMedium, color: Colors.textSecondary },

  // Current value card
  currentCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, margin: Spacing.md, marginBottom: 0,
    padding: Spacing.md, borderRadius: Radius.lg, ...Shadow.sm,
  },
  currentLeft: {},
  currentLabel: { ...Typography.headlineSmall, color: Colors.text, fontWeight: '700' },
  currentRange: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  currentRight: { alignItems: 'flex-end' },
  currentValue: { fontSize: 32, fontWeight: '800', lineHeight: 36 },
  currentUnit: { ...Typography.bodySmall, color: Colors.textMuted },
  currentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, marginTop: 4,
  },
  currentBadgeText: { ...Typography.labelSmall, fontWeight: '700' },

  // Range bar
  rangeBarCard: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing.md,
    marginTop: Spacing.sm, padding: Spacing.md,
    borderRadius: Radius.lg, ...Shadow.sm,
  },
  rangeBarLabel: { ...Typography.bodySmall, color: Colors.textMuted, marginBottom: Spacing.xs },

  // Trend chart
  chartCard: {
    backgroundColor: Colors.surface, margin: Spacing.md, marginTop: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.lg, ...Shadow.sm,
  },
  oneReportNote: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.md, marginTop: Spacing.sm,
    padding: Spacing.md, backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  oneReportText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1 },

  listTitle: {
    ...Typography.headlineSmall, color: Colors.text, fontWeight: '700',
    paddingHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: Spacing.sm,
  },

  // Report card
  reportCard: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing.md,
    marginBottom: Spacing.md, borderRadius: Radius.lg, ...Shadow.sm,
    overflow: 'hidden',
  },
  reportCardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, paddingBottom: Spacing.sm,
  },
  reportDate: { ...Typography.labelLarge, color: Colors.text, fontWeight: '700' },
  reportTime: { ...Typography.bodySmall, color: Colors.textMuted },
  reportRight: { flexDirection: 'row', alignItems: 'center' },
  duplicateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  duplicateBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#C2410C',
  },
  riskBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full },
  riskBadgeText: { ...Typography.labelSmall, fontWeight: '800' },

  // Quick stats
  quickRow: {
    flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
  },
  quickStat: {
    backgroundColor: Colors.background, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2,
    alignItems: 'center', minWidth: 60,
  },
  quickStatLabel: { ...Typography.labelSmall, color: Colors.textMuted },
  quickStatValue: { ...Typography.headlineSmall, fontWeight: '800', lineHeight: 22 },
  quickStatUnit: { fontSize: 9, color: Colors.textMuted },
  quickDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },

  // Score bar
  scoreRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
  },
  scoreLabel: { ...Typography.bodySmall, color: Colors.textMuted, width: 70 },
  scoreBarBg: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 3 },
  scoreValue: { ...Typography.labelMedium, fontWeight: '700', width: 28, textAlign: 'right' },

  // Expanded parameters table
  expandedSection: {
    borderTopWidth: 1, borderTopColor: Colors.border, margin: Spacing.md, marginTop: 0,
  },
  expandedTitle: {
    ...Typography.labelLarge, color: Colors.text, fontWeight: '700',
    paddingVertical: Spacing.md,
  },
  tableHead: {
    flexDirection: 'row', backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
  },
  thCell: { ...Typography.labelSmall, color: 'rgba(255,255,255,0.85)', fontWeight: '700', letterSpacing: 0.5 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: Spacing.xs,
  },
  paramName: { ...Typography.labelMedium, color: Colors.text, fontWeight: '600' },
  paramUnit: { ...Typography.bodySmall, color: Colors.textMuted },
  paramValue: { fontSize: 15, fontWeight: '800', width: 72, textAlign: 'right' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 2, paddingVertical: 3, borderRadius: Radius.full,
  },
  statusText: { ...Typography.labelSmall, fontWeight: '700' },
  refText: { ...Typography.bodySmall, color: Colors.textMuted, width: 90, textAlign: 'right' },

  // AI summary
  aiSummaryBox: {
    backgroundColor: Colors.primarySurface, borderRadius: Radius.md,
    padding: Spacing.md, marginTop: Spacing.md,
  },
  aiSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  aiSummaryTitle: { ...Typography.labelLarge, color: Colors.primary, fontWeight: '700' },
  aiSummaryText: { ...Typography.bodySmall, color: Colors.text, lineHeight: 18 },
});

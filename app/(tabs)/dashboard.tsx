import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, ActivityIndicator,
  Modal, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { useReports } from '../../hooks/useReports';
import { LogoBrand } from '../../components/Logo';
import { Report } from '../../types';
import { updateUserProfile } from '../../services/auth';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const TEAL      = '#14B8A6';
const TEAL_DARK = '#0D9488';
const MAX_W     = 520;

const CKD_LABELS: Record<number, string> = {
  1: 'Normal or high kidney function.',
  2: 'Mild loss of kidney function.',
  3: 'Moderate loss of kidney function.',
  4: 'Severe loss of kidney function.',
  5: 'Kidney failure.',
};

export default function DashboardScreen() {
  const { user, profile } = useAuth();
  const { latestReport, reports, loading, refresh } = useReports(user?.uid);
  const [waterGlasses, setWaterGlasses]       = useState(0);
  const [activeTab, setActiveTab]             = useState<'eGFR' | 'Creat.' | 'BUN'>('eGFR');
  const [checkupDate, setCheckupDate]         = useState('');
  const [showCheckupModal, setShowCheckupModal] = useState(false);
  const [checkupInput, setCheckupInput]       = useState('');
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  useEffect(() => {
    if (profile?.nextCheckupDate) {
      setCheckupDate(profile.nextCheckupDate);
    } else if (typeof window !== 'undefined') {
      const saved = (window as any).localStorage?.getItem('rv_checkup_date');
      if (saved) setCheckupDate(saved);
    }

    const today = new Date().toDateString();
    if (typeof window !== 'undefined') {
      const waterData = (window as any).localStorage?.getItem('rv_water_data');
      if (waterData) {
        const { date, glasses } = JSON.parse(waterData);
        if (date === today) setWaterGlasses(glasses);
      }
    }
  }, [profile]);

  const updateWaterGlasses = (g: number) => {
    setWaterGlasses(g);
    if (typeof window !== 'undefined') {
      (window as any).localStorage?.setItem('rv_water_data', JSON.stringify({
        date: new Date().toDateString(),
        glasses: g,
      }));
    }
  };

  const name        = (profile?.name ?? 'User').toUpperCase();
  const ckdStage    = latestReport?.analysis?.ckdStage;
  const riskScore   = latestReport?.analysis?.riskScore ?? 0;
  const healthScore = latestReport ? Math.max(0, 100 - riskScore) : 0;
  const egfr        = latestReport?.parameters?.egfr ?? latestReport?.analysis?.estimatedEgfr;
  const creatinine  = latestReport?.parameters?.creatinine;
  const bun         = latestReport?.parameters?.bun;
  const systolic    = (latestReport?.parameters as any)?.systolicBP;
  const diastolic   = (latestReport?.parameters as any)?.diastolicBP;
  const bp          = systolic && diastolic ? `${systolic}/${diastolic}` : null;

  return (
    <View style={s.root}>
      {/* ── Navbar ── */}
      <View style={s.navbar}>
        <View style={s.navInner}>
          <LogoBrand size="sm" />
          <View style={s.navRight}>
            <TouchableOpacity style={s.navBtn} onPress={() => setShowNotificationsModal(true)}>
              <Ionicons name="notifications-outline" size={22} color="#333" />
              <View style={s.navBadge} />
            </TouchableOpacity>
            <TouchableOpacity style={s.avatar} onPress={() => router.push('/(tabs)/profile')}>
              <Ionicons name="person" size={15} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={TEAL} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.inner}>
          {/* ── Greeting + Score ── */}
          <View style={s.greetRow}>
            <View>
              <Text style={s.greetSub}>Good {timeOfDay()},</Text>
              <Text style={s.greetName}>{name}</Text>
            </View>
            {latestReport ? (
              <ScoreRing score={healthScore} />
            ) : (
              <View style={[s.scoreRing, { borderColor: '#E2E8F0' }]}>
                <Text style={[s.scoreNum, { color: '#CBD5E0' }]}>—</Text>
              </View>
            )}
          </View>

          {/* ── Duplicate Report Warning ── */}
          {latestReport?.isDuplicate && (
            <View style={s.duplicateBanner}>
              <Ionicons name="copy-outline" size={16} color="#C2410C" />
              <Text style={s.duplicateBannerTxt}>
                You uploaded a duplicate report. Showing latest analysis (2nd Copy).
              </Text>
            </View>
          )}

          {/* ── CKD Stage / Loading ── */}
          {loading && !latestReport ? (
            <LinearGradient colors={[TEAL, TEAL_DARK]} style={s.ckdCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <View style={s.centeredCard}>
                <ActivityIndicator color="rgba(255,255,255,0.9)" />
                <Text style={[s.loadingTxt, { color: 'rgba(255,255,255,0.85)' }]}>Loading health data…</Text>
              </View>
            </LinearGradient>
          ) : !latestReport ? (
            <LinearGradient colors={[TEAL, TEAL_DARK]} style={s.ckdCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.ckdLbl}>CKD ANALYSIS</Text>
              <Text style={s.ckdDesc}>Upload a lab report to see your kidney health stage and analysis.</Text>
              <TouchableOpacity style={s.ckdUploadBtn} onPress={() => router.push('/(tabs)/scan')}>
                <Text style={s.ckdUploadTxt}>Upload Lab Report</Text>
              </TouchableOpacity>
            </LinearGradient>
          ) : ckdStage ? (
            <LinearGradient
              colors={[TEAL, TEAL_DARK]}
              style={s.ckdCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={s.ckdTop}>
                <Text style={s.ckdLbl}>CKD STAGE{' '}<Text style={s.ckdNum}>{ckdStage}</Text></Text>
              </View>
              <Text style={s.ckdDesc}>{CKD_LABELS[ckdStage]}</Text>
              <View style={s.ckdProgress}>
                {[1, 2, 3, 4, 5].map(i => (
                  <View
                    key={i}
                    style={[
                      s.ckdSeg,
                      {
                        backgroundColor: i <= ckdStage ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.28)',
                        marginRight: i < 5 ? 6 : 0,
                      },
                    ]}
                  />
                ))}
              </View>
            </LinearGradient>
          ) : null}

          {/* ── Key Metrics ── */}
          <View style={s.secRow}>
            <Text style={s.secTitle}>Key Metrics</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
              <Text style={s.seeAll}>See all ›</Text>
            </TouchableOpacity>
          </View>
          <View style={s.metricsGrid}>
            <MetricCard
              icon="pulse-outline"
              color={TEAL}
              label="eGFR"
              value={egfr != null ? egfr.toFixed(0) : '—'}
              unit="mL/min"
            />
            <MetricCard
              icon="flame-outline"
              color="#F59E0B"
              label="Creatinine"
              value={creatinine != null ? creatinine.toFixed(1) : '—'}
              unit="mg/dL"
            />
            <MetricCard
              icon="heart-outline"
              color="#EF4444"
              label="Blood Pressure"
              value={bp ?? '—'}
              unit="mmHg"
            />
            <MetricCard
              icon="flask-outline"
              color={TEAL}
              label="BUN"
              value={bun != null ? String(bun) : '—'}
              unit="mg/dL"
            />
          </View>

          {/* ── Daily Water Intake ── */}
          <View style={s.card}>
            <View style={s.waterRow}>
              <View>
                <Text style={s.cardTitle}>Daily Water Intake</Text>
                <Text style={s.cardSub}>Goal: 2.5L for kidney health</Text>
              </View>
              <View style={s.waterCtrl}>
                <TouchableOpacity
                  style={s.wBtn}
                  onPress={() => updateWaterGlasses(Math.max(0, waterGlasses - 1))}
                >
                  <Ionicons name="remove" size={16} color="#666" />
                </TouchableOpacity>
                <Text style={s.waterNum}>
                  {waterGlasses} <Text style={s.glassLbl}>glasses</Text>
                </Text>
                <TouchableOpacity
                  style={s.wBtn}
                  onPress={() => updateWaterGlasses(Math.min(8, waterGlasses + 1))}
                >
                  <Ionicons name="add" size={16} color={TEAL} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.drops}>
              {Array.from({ length: 8 }).map((_, i) => (
                <TouchableOpacity key={i} onPress={() => updateWaterGlasses(i + 1)}>
                  <Ionicons
                    name={i < waterGlasses ? 'water' : 'water-outline'}
                    size={26}
                    color={i < waterGlasses ? TEAL : '#CBD5E0'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── eGFR Trend ── */}
          <View style={s.card}>
            <View style={s.trendHead}>
              <Text style={s.cardTitle}>eGFR Trend</Text>
              <View style={s.tabRow}>
                {(['eGFR', 'Creat.', 'BUN'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.tabPill, activeTab === t && s.tabPillActive]}
                    onPress={() => setActiveTab(t)}
                  >
                    <Text style={[s.tabPillTxt, activeTab === t && s.tabPillTxtActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TrendPreview tab={activeTab} reports={reports} sex={profile?.sex ?? 'male'} />
          </View>

          {/* ── Next Checkup ── */}
          <View style={[s.card, s.checkupCard]}>
            <View style={s.checkupIcon}>
              <Ionicons name="calendar-outline" size={20} color={TEAL} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Next Checkup</Text>
              <Text style={s.cardSub}>{checkupDate || 'Set your next appointment'}</Text>
            </View>
            <TouchableOpacity
              style={s.setBtn}
              onPress={() => { setCheckupInput(checkupDate); setShowCheckupModal(true); }}
            >
              <Text style={s.setBtnTxt}>{checkupDate ? 'Edit' : 'Set'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* ── Checkup Modal ── */}
      <Modal visible={showCheckupModal} transparent animationType="fade" onRequestClose={() => setShowCheckupModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Set Next Checkup</Text>
            <Text style={s.modalSub}>Enter your appointment date</Text>
            <TextInput
              style={s.modalInput}
              value={checkupInput}
              onChangeText={setCheckupInput}
              placeholder="e.g. July 15, 2026"
              placeholderTextColor="#94A3B8"
              autoFocus
            />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowCheckupModal(false)}>
                <Text style={s.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalSave}
                onPress={async () => {
                  const date = checkupInput.trim();
                  setCheckupDate(date);
                  if (typeof window !== 'undefined') {
                    (window as any).localStorage?.setItem('rv_checkup_date', date);
                  }
                  if (user) {
                    try {
                      await updateUserProfile(user.uid, { nextCheckupDate: date });
                    } catch (e) {
                      console.error('[Dashboard] Failed to save checkup date:', e);
                    }
                  }
                  setShowCheckupModal(false);
                }}
              >
                <Text style={s.modalSaveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Notifications Modal ── */}
      <Modal visible={showNotificationsModal} transparent animationType="slide" onRequestClose={() => setShowNotificationsModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.notifHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="notifications" size={20} color={TEAL} />
                <Text style={s.modalTitle}>Notifications</Text>
              </View>
              <TouchableOpacity onPress={() => setShowNotificationsModal(false)} style={s.closeNotifBtn}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={s.notifList} showsVerticalScrollIndicator={false}>
              {/* Water Reminder */}
              <View style={s.notifItem}>
                <View style={[s.notifIcon, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="water" size={18} color="#0284C7" />
                </View>
                <View style={s.notifContent}>
                  <Text style={s.notifTitle}>Stay Hydrated!</Text>
                  <Text style={s.notifDesc}>
                    You've logged {waterGlasses} glass{waterGlasses !== 1 ? 'es' : ''} of water today. Target is 8 glasses (2.5L) daily.
                  </Text>
                </View>
              </View>

              {/* Checkup Reminder */}
              <View style={s.notifItem}>
                <View style={[s.notifIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="calendar" size={18} color="#D97706" />
                </View>
                <View style={s.notifContent}>
                  <Text style={s.notifTitle}>Next Appointment</Text>
                  <Text style={s.notifDesc}>
                    {checkupDate 
                      ? `Your next doctor visit is scheduled for ${checkupDate}.` 
                      : 'No appointment date set. Keep track of your next checkup by setting the date below.'}
                  </Text>
                </View>
              </View>

              {/* Health Update */}
              {latestReport && (
                <View style={s.notifItem}>
                  <View style={[s.notifIcon, { backgroundColor: latestReport.isDuplicate ? '#FFEDD5' : '#DCFCE7' }]}>
                    <Ionicons name="analytics" size={18} color={latestReport.isDuplicate ? '#C2410C' : '#16A34A'} />
                  </View>
                  <View style={s.notifContent}>
                    <Text style={s.notifTitle}>
                      Latest Analysis Status {latestReport.isDuplicate ? '(Duplicate)' : ''}
                    </Text>
                    <Text style={s.notifDesc}>
                      {latestReport.isDuplicate ? '[Duplicate Report] ' : ''}Stage G{ckdStage} detected. Your Kidney Health Score is {healthScore}/100 based on your last lab report.
                    </Text>
                  </View>
                </View>
              )}

              {/* General Tip */}
              <View style={s.notifItem}>
                <View style={[s.notifIcon, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="leaf" size={18} color="#7C3AED" />
                </View>
                <View style={s.notifContent}>
                  <Text style={s.notifTitle}>Kidney Care Tip</Text>
                  <Text style={s.notifDesc}>
                    Limit high-sodium foods and processed items. Eating fresh fruits, vegetables, and low-protein meals helps reduce strain on kidneys.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity style={s.dismissBtn} onPress={() => setShowNotificationsModal(false)}>
              <Text style={s.dismissBtnTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? '#22C55E' : score >= 40 ? '#F59E0B' : '#EF4444';
  return (
    <View style={[s.scoreRing, { borderColor: color }]}>
      <Text style={[s.scoreNum, { color }]}>{score}</Text>
      <Text style={s.scoreSub}>score</Text>
    </View>
  );
}

function MetricCard({ icon, color, label, value, unit }: {
  icon: any; color: string; label: string; value: string; unit: string;
}) {
  return (
    <View style={s.metricCard}>
      <View style={s.metricTop}>
        <Ionicons name={icon} size={22} color={color} />
        <Ionicons name="ellipsis-horizontal" size={14} color="#CBD5E0" />
      </View>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value} <Text style={s.metricUnit}>{unit}</Text></Text>
    </View>
  );
}

function TrendPreview({ tab, reports, sex }: { tab: 'eGFR' | 'Creat.' | 'BUN'; reports: Report[]; sex: 'male' | 'female' }) {
  const actualPoints = [...reports]
    .reverse()
    .map(r => {
      const val =
        tab === 'eGFR'    ? (r.parameters.egfr ?? r.analysis.estimatedEgfr ?? null)
        : tab === 'Creat.' ? (r.parameters.creatinine ?? null)
        :                    (r.parameters.bun ?? null);
      return val != null ? { val, date: r.createdAt } : null;
    })
    .filter((p): p is { val: number; date: string } => p !== null)
    .slice(-8);

  const SAMPLE_DATA: Record<'eGFR' | 'Creat.' | 'BUN', number[]> = {
    eGFR:   [85, 88, 91, 94],
    'Creat.': [1.4, 1.3, 1.1, 0.9],
    BUN:    [24, 21, 18, 14],
  };

  function getSamplePoints(): { val: number; date: string }[] {
    const vals = SAMPLE_DATA[tab];
    const now = new Date();
    return vals.map((v, idx) => {
      const d = new Date(now.getTime() - (3 - idx) * 7 * 24 * 60 * 60 * 1000);
      return { val: v, date: d.toISOString() };
    });
  }

  let dataPoints: { val: number; date: string }[] = [];
  let isSample = false;
  let isBaseline = false;

  if (reports.length === 0 || actualPoints.length === 0) {
    dataPoints = getSamplePoints();
    isSample = true;
  } else if (actualPoints.length === 1) {
    let baselineVal = 100;
    if (tab === 'Creat.') {
      baselineVal = sex === 'male' ? 1.05 : 0.82;
    } else if (tab === 'BUN') {
      baselineVal = 13.5;
    } else if (tab === 'eGFR') {
      baselineVal = 95;
    }

    const reportDate = new Date(actualPoints[0].date);
    const baselineDate = new Date(reportDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    dataPoints = [
      { val: baselineVal, date: baselineDate },
      actualPoints[0]
    ];
    isBaseline = true;
  } else {
    dataPoints = actualPoints;
  }

  const vals = dataPoints.map(p => p.val);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const spread = Math.max(8, (maxV - minV) * 1.5);
  const mid    = (minV + maxV) / 2;
  const yMax   = Math.ceil(mid + spread / 2);
  const yMin   = Math.max(0, Math.floor(mid - spread / 2));
  const yRange = yMax - yMin;

  const numLabels = 9;
  const yLabels = Array.from({ length: numLabels }, (_, i) =>
    Math.round(yMax - (i * yRange) / (numLabels - 1))
  );

  const firstDate = dataPoints[0]?.date;
  const lastDate = dataPoints[dataPoints.length - 1]?.date;
  const startDateStr = firstDate ? format(new Date(firstDate), 'MMM d, yyyy') : '';
  const endDateStr = lastDate ? format(new Date(lastDate), 'MMM d, yyyy') : '';
  const dateStr = startDateStr === endDateStr ? startDateStr : `${startDateStr} — ${endDateStr}`;

  // Construct smooth Bezier path and area path coordinates
  let pathD = '';
  let areaD = '';

  if (dataPoints.length > 0) {
    const coords = dataPoints.map((p, i) => {
      const x = dataPoints.length > 1 ? (i / (dataPoints.length - 1)) * 86 + 7 : 50;
      const y = ((yMax - p.val) / yRange) * 80 + 10;
      return { x, y };
    });

    pathD = `M ${coords[0].x} ${coords[0].y}`;
    areaD = `M ${coords[0].x} 100 L ${coords[0].x} ${coords[0].y}`;

    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i];
      const p1 = coords[i + 1];

      const cp1x = p0.x + (p1.x - p0.x) / 3;
      const cp1y = p0.y;
      const cp2x = p0.x + (2 * (p1.x - p0.x)) / 3;
      const cp2y = p1.y;

      const segment = ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
      pathD += segment;
      areaD += segment;
    }

    const lastCoord = coords[coords.length - 1];
    areaD += ` L ${lastCoord.x} 100 Z`;
  }

  return (
    <View style={{ paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>{dateStr}</Text>
        {isSample && (
          <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#0369A1', fontWeight: '700' }}>Demo Trend</Text>
          </View>
        )}
        {isBaseline && (
          <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#B45309', fontWeight: '700' }}>Baseline comparison</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', height: 150 }}>
        {/* Y-axis labels */}
        <View style={s.yAxis}>
          {yLabels.map((v, i) => (
            <Text key={i} style={s.yLabel}>{v}</Text>
          ))}
        </View>
        {/* Chart area */}
        <View style={s.chartArea}>
          {/* Grid lines */}
          {yLabels.map((_, i) => (
            <View key={i} style={s.gridLine} />
          ))}

          {/* Connected SVG curved Line & Gradient Area */}
          {dataPoints.length > 1 && (
            <View style={StyleSheet.absoluteFill}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <Defs>
                  <SvgLinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={TEAL} stopOpacity="0.22" />
                    <Stop offset="100%" stopColor={TEAL} stopOpacity="0.0" />
                  </SvgLinearGradient>
                </Defs>

                {/* Shaded Area */}
                <Path
                  d={areaD}
                  fill="url(#chartGradient)"
                />

                {/* Curved Line */}
                <Path
                  d={pathD}
                  fill="none"
                  stroke={TEAL}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          )}

          {/* Data dots */}
          {dataPoints.map((p, i) => {
            const xPct = dataPoints.length > 1 ? (i / (dataPoints.length - 1)) * 86 + 7 : 50;
            const yPct = ((yMax - p.val) / yRange) * 80 + 10;
            const isLatest = i === dataPoints.length - 1;
            return (
              <View
                key={i}
                style={[
                  s.dataDot,
                  {
                    left: `${xPct}%` as any,
                    top:  `${yPct}%` as any,
                    width:       isLatest ? 10 : 8,
                    height:      isLatest ? 10 : 8,
                    borderRadius: isLatest ? 5 : 4,
                    marginLeft:  isLatest ? -5 : -4,
                    marginTop:   isLatest ? -5 : -4,
                    opacity:     isLatest ? 1 : 0.8,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* X-axis date labels aligned under the dots */}
      <View style={s.xAxis}>
        {dataPoints.map((p, i) => {
          const shouldShow =
            dataPoints.length <= 4 ||
            i === 0 ||
            i === dataPoints.length - 1 ||
            (dataPoints.length === 5 && i === 2) ||
            (dataPoints.length > 5 && i === Math.floor(dataPoints.length / 2));

          if (!shouldShow) return null;

          const xPct = dataPoints.length > 1 ? (i / (dataPoints.length - 1)) * 86 + 7 : 50;
          let dateFormatted = '';
          try {
            dateFormatted = format(new Date(p.date), 'MMM d');
          } catch {
            dateFormatted = '';
          }

          return (
            <Text
              key={i}
              style={[
                s.xLabel,
                {
                  left: `${xPct}%` as any,
                  transform: [{ translateX: -20 }],
                }
              ]}
            >
              {dateFormatted}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F2F5' },

  // Navbar
  navbar: {
    backgroundColor: '#fff',
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  navInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    maxWidth: MAX_W,
    alignSelf: 'center' as any,
    width: '100%',
  },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navBtn:  { padding: 4 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center',
  },

  // Scroll
  scroll:  { flex: 1 },
  content: { paddingVertical: 16, alignItems: 'center' as any },
  inner: {
    width: '100%',
    maxWidth: MAX_W,
    paddingHorizontal: 16,
    gap: 12,
  },

  // Greeting
  greetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  greetSub:  { fontSize: 13, color: '#94A3B8', marginBottom: 2 },
  greetName: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },

  // Score ring
  scoreRing: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
  },
  scoreNum: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  scoreSub: { fontSize: 9, color: '#94A3B8', fontWeight: '600' },

  // CKD card
  ckdCard: { borderRadius: 16, padding: 18 },
  ckdTop: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  ckdLbl: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '700', letterSpacing: 0.8 },
  ckdNum: { fontSize: 24, color: '#fff', fontWeight: '800' },
  ckdDesc: { fontSize: 13, color: 'rgba(255,255,255,0.92)', marginBottom: 14 },
  ckdProgress: { flexDirection: 'row', height: 6 },
  ckdSeg: { flex: 1, height: 6, borderRadius: 3 },
  ckdUploadBtn: {
    alignSelf: 'flex-start' as any,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  ckdUploadTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Generic card
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  cardSub:   { fontSize: 12, color: '#94A3B8', marginTop: 1 },

  // Section header
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  secTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  seeAll:   { fontSize: 13, color: TEAL, fontWeight: '600' },

  // Metrics grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14, flex: 1, minWidth: 130,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  metricTop:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metricLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },
  metricValue: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  metricUnit:  { fontSize: 12, fontWeight: '400', color: '#94A3B8' },

  // Water
  waterRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 14,
  },
  waterCtrl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wBtn: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center',
  },
  waterNum: { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  glassLbl: { fontSize: 12, fontWeight: '400', color: '#94A3B8' },
  drops:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  // Trend
  trendHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  tabRow: { flexDirection: 'row', gap: 6 },
  tabPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#F1F5F9' },
  tabPillActive: { backgroundColor: TEAL },
  tabPillTxt:       { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  tabPillTxtActive: { color: '#fff' },

  yAxis:     { width: 32, justifyContent: 'space-between', paddingVertical: 2 },
  yLabel:    { fontSize: 9, color: '#94A3B8', lineHeight: 12 },
  chartArea: {
    flex: 1, borderLeftWidth: 1, borderLeftColor: '#E2E8F0',
    paddingLeft: 4, position: 'relative', justifyContent: 'space-between',
  },
  gridLine:  { flex: 1, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  dataDot: {
    position: 'absolute',
    backgroundColor: TEAL,
    borderWidth: 2, borderColor: '#fff',
    shadowColor: TEAL, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
  },
  noChart:    { paddingVertical: 28, alignItems: 'center' },
  noChartTxt: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  xAxis: {
    position: 'relative',
    height: 16,
    marginLeft: 32,
    marginTop: 4,
  },
  xLabel: {
    position: 'absolute',
    fontSize: 9,
    color: '#94A3B8',
    width: 40,
    textAlign: 'center',
  },

  // Checkup
  checkupCard:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkupIcon:  {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center',
  },
  setBtn:    { backgroundColor: TEAL, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20 },
  setBtnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff', borderRadius: 20,
    padding: 24, width: '100%', maxWidth: 380,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  modalSub:   { fontSize: 13, color: '#94A3B8', marginBottom: 16 },
  modalInput: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#1A1A2E', marginBottom: 20,
  },
  modalBtns:     { flexDirection: 'row', gap: 12 },
  modalCancel:   {
    flex: 1, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center',
  },
  modalCancelTxt: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  modalSave:     { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: TEAL, alignItems: 'center' },
  modalSaveTxt:  { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Loading
  centeredCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  loadingTxt:   { fontSize: 13, color: '#94A3B8' },

  // Notifications
  navBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  closeNotifBtn: {
    padding: 4,
  },
  notifList: {
    maxHeight: 280,
    width: '100%',
    marginBottom: 16,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  notifIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  notifDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  dismissBtn: {
    backgroundColor: TEAL,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  dismissBtnTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  duplicateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  duplicateBannerTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C2410C',
    flex: 1,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { useReports } from '../../hooks/useReports';
import { signOut, updateUserProfile } from '../../services/auth';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../constants/theme';
import { Sex, Report, RiskLevel } from '../../types';
import { TrendChart } from '../../components/TrendChart';


const RISK_COLORS: Record<RiskLevel, string> = {
  low:      '#1B8A4E',
  moderate: '#CA8A04',
  high:     '#EA580C',
  critical: '#7C3AED',
};

export default function ProfileScreen() {
  const { user, profile } = useAuth();
  const { reports }       = useReports(user?.uid);

  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState('');
  const [age, setAge]         = useState('');
  const [sex, setSex]         = useState<Sex>('male');
  const [saving, setSaving]   = useState(false);

  // Sync edit fields whenever profile loads or changes
  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setAge(profile.age?.toString() ?? '');
      setSex(profile.sex ?? 'male');
    }
  }, [profile]);

  function openEdit() {
    setName(profile?.name ?? '');
    setAge(profile?.age?.toString() ?? '');
    setSex(profile?.sex ?? 'male');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveProfile() {
    if (!user) return;
    const ageNum = parseInt(age, 10);
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      Alert.alert('Invalid age', 'Please enter a valid age between 1 and 120.');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile(user.uid, { name: name.trim(), age: ageNum, sex });
      setEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    if (Platform.OS === 'web') {
      // window.confirm is the only reliable confirmation on web
      if (!window.confirm('Are you sure you want to sign out?')) return;
      try {
        await signOut();
        router.replace('/(auth)/login');
      } catch (e: any) {
        Alert.alert('Error', e.message ?? 'Could not sign out.');
      }
      return;
    }

    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/(auth)/login');
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Could not sign out.');
            }
          },
        },
      ],
    );
  }

  const firstName    = profile?.name?.split(' ')[0] ?? 'User';
  const lastScan     = reports[0]?.createdAt;
  const latestStage  = reports[0]?.analysis?.ckdStage;
  const latestRisk   = reports[0]?.analysis?.riskLevel;

  // ── Edit screen ─────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.editHeader}>
            <TouchableOpacity onPress={cancelEdit} style={styles.editBackBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.editHeaderTitle}>Edit Profile</Text>
            <View style={{ width: 40 }} />
          </LinearGradient>

          <View style={styles.editBody}>
            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Age */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Age (years)</Text>
              <Text style={styles.fieldHint}>Used for accurate CKD-EPI eGFR calculation</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  placeholder="e.g. 28"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Biological sex */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Biological Sex</Text>
              <Text style={styles.fieldHint}>Required for accurate eGFR calculation</Text>
              <View style={styles.sexRow}>
                {(['male', 'female'] as Sex[]).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sexBtn, sex === s && styles.sexBtnActive]}
                    onPress={() => setSex(s)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={s === 'male' ? 'male' : 'female'}
                      size={20}
                      color={sex === s ? Colors.white : Colors.primary}
                    />
                    <Text style={[styles.sexBtnText, sex === s && styles.sexBtnTextActive]}>
                      {s === 'male' ? 'Male' : 'Female'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveProfile}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.saveBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {saving
                  ? <Text style={styles.saveBtnText}>Saving...</Text>
                  : <>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                      <Text style={styles.saveBtnText}>Save Changes</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── View screen ─────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient colors={[Colors.primary, Colors.primaryLight]} style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{firstName[0]?.toUpperCase() ?? 'U'}</Text>
        </View>
        <Text style={styles.profileName}>{profile?.name ?? 'Your Profile'}</Text>
        <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
        <TouchableOpacity style={styles.editIconBtn} onPress={openEdit}>
          <Ionicons name="pencil" size={16} color={Colors.white} />
          <Text style={styles.editIconText}>Edit</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Personal info card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="person-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>Personal Information</Text>
          <TouchableOpacity onPress={openEdit} style={styles.cardEditBtn}>
            <Ionicons name="pencil-outline" size={18} color={Colors.primary} />
            <Text style={styles.cardEditText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <InfoRow icon="person-outline"   label="Full Name"       value={profile?.name ?? '—'} />
        <InfoRow icon="mail-outline"     label="Email Address"   value={user?.email ?? '—'} />
        <InfoRow icon="calendar-outline" label="Age"             value={profile?.age ? `${profile.age} years old` : '—'} />
        <InfoRow icon="body-outline"     label="Biological Sex"  value={profile?.sex ? (profile.sex === 'male' ? 'Male' : 'Female') : '—'} />
        {lastScan && (
          <InfoRow icon="time-outline" label="Last Scan" value={format(new Date(lastScan), 'MMM d, yyyy · h:mm a')} />
        )}
      </View>

      {/* About card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.cardTitle}>About RenalVault AI</Text>
        </View>
        <Text style={styles.aboutText}>
          RenalVault AI uses AI and OCR to analyze kidney lab reports, detect CKD risk, and provide personalized health recommendations powered by Grok AI.
        </Text>
        {[
          'Auto-detects lab values from PDF & image reports',
          'CKD-EPI eGFR calculation (2021 race-free formula)',
          'KDIGO CKD staging (Stage G1–G5)',
          'Grok AI personalized recommendations',
          'Real-time health trend monitoring',
          'Secure Firebase cloud storage',
        ].map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
        <View style={styles.versionRow}>
          <Text style={styles.versionText}>RenalVault AI · Version 1.0.0</Text>
        </View>
        <Text style={styles.disclaimer}>
          For informational purposes only. Always consult a qualified nephrologist for medical advice.
        </Text>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  );
}

function ReportRow({ report }: { report: Report }) {
  const rc   = RISK_COLORS[report.analysis.riskLevel];
  const egfr = report.parameters.egfr ?? report.analysis.estimatedEgfr;
  return (
    <View style={styles.reportRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.reportRowDate}>
          {format(new Date(report.createdAt), 'MMM d, yyyy')}
        </Text>
        <Text style={styles.reportRowTime}>
          {format(new Date(report.createdAt), 'h:mm a')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {egfr != null && (
          <Text style={styles.reportEgfr}>eGFR {egfr.toFixed(0)}</Text>
        )}
        {report.analysis.ckdStage ? (
          <View style={[styles.stageBadge, { backgroundColor: Colors.primary + '18' }]}>
            <Text style={[styles.stageBadgeTxt, { color: Colors.primary }]}>
              G{report.analysis.ckdStage}
            </Text>
          </View>
        ) : null}
        <View style={[styles.riskDot, { backgroundColor: rc }]} />
      </View>
    </View>
  );
}

function StatCard({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={17} color={Colors.textMuted} style={{ marginTop: 1 }} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // View header
  header: {
    alignItems: 'center',
    paddingTop: 64, paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: Colors.white },
  profileName: { ...Typography.headlineLarge, color: Colors.white, fontWeight: '800' },
  profileEmail: { ...Typography.bodyMedium, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  editIconBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: Spacing.md, backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
  },
  editIconText: { ...Typography.labelMedium, color: Colors.white },

  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', gap: 4, ...Shadow.sm,
  },
  statValue: { ...Typography.headlineMedium, color: Colors.text, fontWeight: '800' },
  statLabel: { ...Typography.bodySmall, color: Colors.textMuted },

  // Info card
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    padding: Spacing.md, ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  cardTitle: { ...Typography.headlineSmall, color: Colors.text, fontWeight: '700', flex: 1 },
  cardEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardEditText: { ...Typography.labelMedium, color: Colors.primary },

  // Info row
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  infoContent: { flex: 1 },
  infoLabel: { ...Typography.bodySmall, color: Colors.textMuted },
  infoValue: { ...Typography.bodyMedium, color: Colors.text, fontWeight: '600', marginTop: 1 },

  // About
  aboutText: { ...Typography.bodyMedium, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 22 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  featureText: { ...Typography.bodySmall, color: Colors.textSecondary },
  versionRow: { marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  versionText: { ...Typography.bodySmall, color: Colors.textMuted, textAlign: 'center' },
  disclaimer: { ...Typography.bodySmall, color: Colors.textMuted, fontStyle: 'italic', marginTop: Spacing.sm, textAlign: 'center' },

  // Report row
  reportRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  reportRowDate: { fontSize: 13, fontWeight: '600', color: Colors.text },
  reportRowTime: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  reportEgfr: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  stageBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  stageBadgeTxt: { fontSize: 11, fontWeight: '700' },
  riskDot: { width: 9, height: 9, borderRadius: 5 },

  // No reports / upload
  noReportsBox: { alignItems: 'center', paddingVertical: Spacing.lg, gap: 8 },
  noReportsText: {
    fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20,
  },
  uploadBtn: {
    marginTop: 4, backgroundColor: Colors.primary,
    paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20,
  },
  uploadBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, marginHorizontal: Spacing.md, padding: Spacing.md,
    backgroundColor: Colors.dangerLight, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.danger + '40',
  },
  signOutText: { ...Typography.headlineSmall, color: Colors.danger, fontWeight: '700' },

  // Edit screen
  editHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 64, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.md,
  },
  editBackBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  editHeaderTitle: { ...Typography.headlineMedium, color: Colors.white, fontWeight: '700' },
  editBody: { padding: Spacing.lg },

  fieldGroup: { marginBottom: Spacing.lg },
  fieldLabel: { ...Typography.labelLarge, color: Colors.text, fontWeight: '700', marginBottom: Spacing.xs },
  fieldHint: { ...Typography.bodySmall, color: Colors.textMuted, marginBottom: Spacing.xs },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 52,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, ...Typography.bodyLarge, color: Colors.text },

  sexRow: { flexDirection: 'row', gap: Spacing.md },
  sexBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  sexBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sexBtnText: { ...Typography.labelLarge, color: Colors.primary },
  sexBtnTextActive: { color: Colors.white },

  saveBtn: { borderRadius: Radius.lg, overflow: 'hidden', marginTop: Spacing.md, ...Shadow.md },
  saveBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md + 2,
  },
  saveBtnText: { ...Typography.headlineSmall, color: Colors.white, fontWeight: '700' },

  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm },
  cancelBtnText: { ...Typography.bodyMedium, color: Colors.textSecondary, fontWeight: '600' },
});

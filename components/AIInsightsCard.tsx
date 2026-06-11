import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AIRecommendationResult, UrgencyLevel } from '../types';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';

interface AIInsightsCardProps {
  insights: AIRecommendationResult;
}

const URGENCY_CONFIG: Record<UrgencyLevel, { color: string; bg: string; icon: any; label: string }> = {
  routine: { color: Colors.success, bg: Colors.successLight, icon: 'checkmark-circle', label: 'Routine' },
  soon: { color: Colors.warning, bg: Colors.warningLight, icon: 'time', label: 'See Doctor Soon' },
  urgent: { color: Colors.danger, bg: Colors.dangerLight, icon: 'alert-circle', label: 'Urgent' },
  emergency: { color: '#7C3AED', bg: '#F3E5F5', icon: 'warning', label: 'Emergency' },
};

export function AIInsightsCard({ insights }: AIInsightsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const urgency = URGENCY_CONFIG[insights.urgency];

  return (
    <>
      <View style={styles.card}>
        {/* Header */}
        <LinearGradient
          colors={[Colors.primary, Colors.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <View style={styles.headerLeft}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles" size={18} color="#FFD700" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Grok AI Insights</Text>
              <Text style={styles.headerSub}>Personalized kidney health analysis</Text>
            </View>
          </View>
          {/* Urgency badge */}
          <View style={[styles.urgencyBadge, { backgroundColor: urgency.color }]}>
            <Ionicons name={urgency.icon} size={12} color="#fff" />
            <Text style={styles.urgencyText}>{urgency.label}</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Summary */}
          <Text style={styles.summary}>{insights.summary}</Text>

          {/* Urgency message */}
          <View style={[styles.urgencyBox, { backgroundColor: urgency.bg }]}>
            <Ionicons name={urgency.icon} size={16} color={urgency.color} />
            <Text style={[styles.urgencyMsg, { color: urgency.color }]}>{insights.urgencyMessage}</Text>
          </View>

          {/* Top 3 recommendations */}
          <Text style={styles.sectionLabel}>Key Recommendations</Text>
          {insights.recommendations.slice(0, 3).map((rec, i) => (
            <View key={i} style={styles.listRow}>
              <View style={[styles.bullet, { backgroundColor: Colors.primary }]} />
              <Text style={styles.listText}>{rec}</Text>
            </View>
          ))}

          {/* Follow-up */}
          <View style={styles.followUpRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
            <Text style={styles.followUpText}>Follow-up: <Text style={styles.followUpBold}>{insights.followUp}</Text></Text>
          </View>

          {/* See full analysis button */}
          <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded(true)} activeOpacity={0.8}>
            <Text style={styles.expandBtnText}>View Full AI Analysis</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Full analysis modal */}
      <Modal visible={expanded} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <Ionicons name="sparkles" size={20} color={Colors.primary} />
              <Text style={styles.modalTitle}>Full AI Analysis</Text>
            </View>
            <TouchableOpacity onPress={() => setExpanded(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Summary */}
            <SectionBlock title="Overview" icon="information-circle-outline">
              <Text style={styles.summaryFull}>{insights.summary}</Text>
            </SectionBlock>

            {/* Urgency */}
            <View style={[styles.urgencyBoxFull, { backgroundColor: urgency.bg }]}>
              <Ionicons name={urgency.icon} size={22} color={urgency.color} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.urgencyLabelFull, { color: urgency.color }]}>{urgency.label}</Text>
                <Text style={[styles.urgencyMsgFull, { color: urgency.color }]}>{insights.urgencyMessage}</Text>
              </View>
            </View>

            {/* Recommendations */}
            <SectionBlock title="Medical Recommendations" icon="medkit-outline">
              {insights.recommendations.map((r, i) => (
                <BulletItem key={i} text={r} color={Colors.primary} />
              ))}
            </SectionBlock>

            {/* Dietary Advice */}
            <SectionBlock title="Dietary Advice" icon="nutrition-outline">
              {insights.dietaryAdvice.map((d, i) => (
                <BulletItem key={i} text={d} color={Colors.success} />
              ))}
            </SectionBlock>

            {/* Lifestyle */}
            <SectionBlock title="Lifestyle Tips" icon="bicycle-outline">
              {insights.lifestyle.map((l, i) => (
                <BulletItem key={i} text={l} color="#7C3AED" />
              ))}
            </SectionBlock>

            {/* Follow-up */}
            <View style={styles.followUpCard}>
              <Ionicons name="calendar" size={20} color={Colors.primary} />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <Text style={styles.followUpCardLabel}>Recommended Follow-up</Text>
                <Text style={styles.followUpCardValue}>{insights.followUp}</Text>
              </View>
            </View>

            {/* Disclaimer */}
            <Text style={styles.disclaimer}>
              This AI analysis is for informational purposes only. Always consult a qualified nephrologist or physician for medical decisions. Powered by Grok AI (xAI).
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function SectionBlock({ title, icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionBlockHeader}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
        <Text style={styles.sectionBlockTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function BulletItem({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.bulletItem}>
      <View style={[styles.bulletDot, { backgroundColor: color }]} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  aiIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...Typography.labelLarge, color: Colors.white, fontWeight: '700' },
  headerSub: { ...Typography.bodySmall, color: 'rgba(255,255,255,0.75)' },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  urgencyText: { ...Typography.labelSmall, color: '#fff', fontWeight: '700' },

  body: { padding: Spacing.md },
  summary: { ...Typography.bodyMedium, color: Colors.text, lineHeight: 22, marginBottom: Spacing.md },

  urgencyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: Radius.sm,
    marginBottom: Spacing.md,
  },
  urgencyMsg: { ...Typography.bodySmall, flex: 1, fontWeight: '600' },

  sectionLabel: { ...Typography.labelLarge, color: Colors.text, marginBottom: Spacing.sm, fontWeight: '700' },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7, marginRight: Spacing.sm },
  listText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1, lineHeight: 20 },

  followUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  followUpText: { ...Typography.bodySmall, color: Colors.textSecondary },
  followUpBold: { fontWeight: '700', color: Colors.text },

  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primarySurface,
    borderRadius: Radius.sm,
  },
  expandBtnText: { ...Typography.labelLarge, color: Colors.primary },

  // Modal
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { ...Typography.headlineMedium, color: Colors.text, fontWeight: '700', marginLeft: Spacing.sm },
  closeBtn: { padding: Spacing.xs },
  modalBody: { padding: Spacing.lg, paddingBottom: Spacing.xxl },

  summaryFull: { ...Typography.bodyMedium, color: Colors.text, lineHeight: 24 },

  urgencyBoxFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
  urgencyLabelFull: { ...Typography.labelLarge, fontWeight: '800' },
  urgencyMsgFull: { ...Typography.bodyMedium, marginTop: 2 },

  sectionBlock: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  sectionBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionBlockTitle: { ...Typography.headlineSmall, color: Colors.text, fontWeight: '700' },
  bulletItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
  bulletDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 7, marginRight: Spacing.sm },
  bulletText: { ...Typography.bodyMedium, color: Colors.text, flex: 1, lineHeight: 22 },

  followUpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySurface,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
  },
  followUpCardLabel: { ...Typography.bodySmall, color: Colors.textSecondary },
  followUpCardValue: { ...Typography.headlineSmall, color: Colors.primary, fontWeight: '700' },

  disclaimer: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import { KidneyParameters } from '../types';
import { getParameterStatus, getParameterRange, PARAMETER_META } from '../utils/ckdAnalysis';

interface ParameterCardProps {
  paramKey: keyof KidneyParameters;
  value: number;
  sex: 'male' | 'female';
}

const STATUS_CONFIG = {
  normal: { color: Colors.success, bg: Colors.successLight, label: 'Normal' },
  high: { color: Colors.danger, bg: Colors.dangerLight, label: 'High' },
  low: { color: Colors.warning, bg: Colors.warningLight, label: 'Low' },
};

export function ParameterCard({ paramKey, value, sex }: ParameterCardProps) {
  const meta = PARAMETER_META[paramKey];
  if (!meta) return null;

  const status = getParameterStatus(paramKey, value, sex);
  const range = getParameterRange(paramKey, sex);
  const config = STATUS_CONFIG[status];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{meta.label}</Text>
        <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
          <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: config.color }]}>
          {value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}
        </Text>
        <Text style={styles.unit}>{meta.unit}</Text>
      </View>

      {range && (
        <Text style={styles.rangeText}>
          Normal: {range.min}–{range.max} {meta.unit}
        </Text>
      )}

      <Text style={styles.description}>{meta.description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Shadow.sm,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    ...Typography.labelLarge,
    color: Colors.text,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  statusText: {
    ...Typography.labelSmall,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: Spacing.xs,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  unit: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  rangeText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  description: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});

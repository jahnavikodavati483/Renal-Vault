import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Colors, Typography, Spacing } from '../constants/theme';
import { RiskLevel, CKDStage } from '../types';
import { getStageName } from '../utils/ckdAnalysis';

interface RiskIndicatorProps {
  riskScore: number;
  riskLevel: RiskLevel;
  ckdStage: CKDStage | null;
  egfr?: number;
}

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  moderate: 'Moderate Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
};

export function RiskIndicator({ riskScore, riskLevel, ckdStage, egfr }: RiskIndicatorProps) {
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI; // half circle

  // We draw a semicircle (arc) from 180° to 0° (left to right, bottom)
  const cx = size / 2;
  const cy = size / 2;
  const r = radius;

  // Progress arc: fill portion based on riskScore
  const progress = Math.min(riskScore / 100, 1);
  const fillLength = circumference * progress;
  const gapLength = circumference - fillLength;

  const color = Colors.riskLevel[riskLevel];

  // Arc path: semicircle, starting from left (180°) going clockwise to right (0°)
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {/* Background track */}
        <Path
          d={arcPath}
          stroke={Colors.border}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        {/* Colored progress arc */}
        <Path
          d={arcPath}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${fillLength} ${gapLength}`}
        />
      </Svg>

      {/* Score overlay */}
      <View style={styles.scoreOverlay}>
        <Text style={[styles.scoreText, { color }]}>{riskScore}</Text>
        <Text style={styles.scoreSubtext}>/ 100</Text>
      </View>

      {/* Risk label */}
      <Text style={[styles.riskLabel, { color }]}>{RISK_LABELS[riskLevel]}</Text>

      {/* CKD Stage */}
      {ckdStage && (
        <View style={[styles.stageBadge, { backgroundColor: Colors.ckdStage[ckdStage] + '18' }]}>
          <Text style={[styles.stageText, { color: Colors.ckdStage[ckdStage] }]}>
            {getStageName(ckdStage)}
          </Text>
        </View>
      )}

      {egfr !== undefined && (
        <Text style={styles.egfrText}>eGFR: {Math.round(egfr)} mL/min/1.73m²</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  scoreOverlay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: -36,
  },
  scoreText: {
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 50,
  },
  scoreSubtext: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
    marginLeft: 2,
  },
  riskLabel: {
    ...Typography.headlineSmall,
    marginTop: Spacing.xs,
    fontWeight: '700',
  },
  stageBadge: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
  },
  stageText: {
    ...Typography.labelMedium,
    fontWeight: '700',
  },
  egfrText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});

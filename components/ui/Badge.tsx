import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, Radius, Spacing } from '../../constants/theme';
import { RiskLevel } from '../../types';

interface BadgeProps {
  label: string;
  riskLevel?: RiskLevel;
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
}

export function Badge({ label, riskLevel, color, backgroundColor, style }: BadgeProps) {
  const bg = backgroundColor ?? (riskLevel ? Colors.riskLevel[riskLevel] + '20' : Colors.primarySurface);
  const fg = color ?? (riskLevel ? Colors.riskLevel[riskLevel] : Colors.primary);

  return (
    <View style={[styles.container, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    ...Typography.labelSmall,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

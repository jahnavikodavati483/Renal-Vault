import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

// ── Logo Icon: Using image file ──────────────────────────────────────────────
export function LogoIcon({ size = 56 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/logo.png')}
      style={{ width: size, height: size, resizeMode: 'contain' }}
    />
  );
}

// ── Full brand mark: icon + wordmark ─────────────────────────────────────────
type LogoSize = 'xs' | 'sm' | 'md' | 'lg';

const SCALES: Record<LogoSize, number> = {
  xs: 0.55,
  sm: 0.75,
  md: 1,
  lg: 1.35,
};

interface LogoBrandProps {
  size?: LogoSize;
  showTagline?: boolean;
  iconOnly?: boolean;
  light?: boolean; // white text for dark backgrounds
}

export function LogoBrand({
  size = 'md',
  showTagline = false,
  iconOnly = false,
  light = false,
}: LogoBrandProps) {
  const sc = SCALES[size];
  const iconSize = Math.round(52 * sc);

  if (iconOnly) return <LogoIcon size={iconSize} />;

  return (
    <View style={styles.row}>
      <LogoIcon size={iconSize} />
      <View style={styles.textBlock}>
        <Text style={[styles.wordmark, { fontSize: Math.round(17 * sc) }]}>
          <Text style={[styles.renal, light && { color: '#fff' }]}>RENAL</Text>
          <Text style={[styles.vault, light && { color: 'rgba(255,255,255,0.9)' }]}>VAULT AI</Text>
        </Text>
        {showTagline && (
          <Text style={[styles.tagline, { fontSize: Math.round(9 * sc) }, light && { color: 'rgba(255,255,255,0.7)' }]}>
            Kidney Health | Secure &amp; Intelligent
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  textBlock: { justifyContent: 'center' },
  wordmark: { fontWeight: '800', letterSpacing: 0.4, lineHeight: 22 },
  renal: { color: '#1B2E5E' },
  vault: { color: '#2D9B5E' },
  tagline: { color: '#64748B', letterSpacing: 0.3, marginTop: 1 },
});

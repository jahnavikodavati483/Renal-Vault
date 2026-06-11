export const Colors = {
  primary: '#14B8A6',
  primaryLight: '#0D9488',
  primaryLighter: '#5EEAD4',
  primarySurface: '#CCFBF1',

  success: '#1B8A4E',
  successLight: '#D1FAE5',

  warning: '#B45309',
  warningLight: '#FEF3C7',

  danger: '#C62828',
  dangerLight: '#FFEBEE',

  critical: '#6A1B9A',
  criticalLight: '#F3E5F5',

  text: '#1A1A2E',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',

  background: '#F5F7FA',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  divider: '#F1F5F9',

  white: '#FFFFFF',
  black: '#000000',

  ckdStage: {
    1: '#1B8A4E',
    2: '#65A30D',
    3: '#CA8A04',
    4: '#EA580C',
    5: '#C62828',
  },

  riskLevel: {
    low: '#1B8A4E',
    moderate: '#CA8A04',
    high: '#EA580C',
    critical: '#C62828',
  },
};

export const Typography = {
  displayLarge: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  displayMedium: { fontSize: 26, fontWeight: '700' as const, lineHeight: 34 },
  headlineLarge: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  headlineMedium: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  headlineSmall: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  labelLarge: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  labelMedium: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
  labelSmall: { fontSize: 10, fontWeight: '600' as const, lineHeight: 14 },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};

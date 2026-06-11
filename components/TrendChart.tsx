import React from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import { ChartDataPoint } from '../types';
import { format } from 'date-fns';

interface TrendChartProps {
  title: string;
  unit: string;
  data: ChartDataPoint[];
  color?: string;
  normalMin?: number;
  normalMax?: number;
  isSample?: boolean;
  isBaseline?: boolean;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export function TrendChart({
  title,
  unit,
  data,
  color = Colors.primary,
  normalMin,
  normalMax,
  isSample = false,
  isBaseline = false,
}: TrendChartProps) {
  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data to show trend.</Text>
        <Text style={styles.emptySubtext}>Scan reports to see trends.</Text>
      </View>
    );
  }

  const values = data.map((d) => d.value);
  const latest = values[values.length - 1];
  const previous = values.length > 1 ? values[values.length - 2] : latest;
  const trend = latest > previous ? 'up' : latest < previous ? 'down' : 'stable';
  const trendIcon = values.length > 1 ? (trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→') : '';
  const trendColor =
    values.length > 1
      ? trend === 'stable'
        ? Colors.textSecondary
        : trend === 'up'
        ? Colors.danger
        : Colors.success
      : Colors.textMuted;

  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const spread = Math.max(8, (maxV - minV) * 1.5);
  const mid = (minV + maxV) / 2;
  const yMax = Math.ceil(mid + spread / 2);
  const yMin = Math.max(0, Math.floor(mid - spread / 2));
  const yRange = yMax - yMin;

  const numLabels = 5; // Clean, uncluttered layout for Y-axis
  const yLabels = Array.from({ length: numLabels }, (_, i) =>
    Math.round(yMax - (i * yRange) / (numLabels - 1))
  );

  // Construct smooth Bezier path and area path coordinates
  let pathD = '';
  let areaD = '';

  const coords = data.map((p, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * 86 + 7 : 50;
    const y = ((yMax - p.value) / yRange) * 80 + 10;
    return { x, y };
  });

  if (coords.length > 0) {
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

  // Unique ID for SVG gradient to avoid conflict with other chart instances
  const gradientId = `gradient-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' }}>
            <Text style={styles.title}>{title}</Text>
            {isSample && (
              <View style={[styles.badge, { backgroundColor: '#E0F2FE' }]}>
                <Text style={[styles.badgeText, { color: '#0369A1' }]}>Demo Chart</Text>
              </View>
            )}
            {isBaseline && (
              <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.badgeText, { color: '#B45309' }]}>Baseline Comparison</Text>
              </View>
            )}
          </View>
          <Text style={styles.unit}>{unit}</Text>
        </View>
        {values.length > 1 && (
          <View style={styles.trendBadge}>
            <Text style={[styles.trendIcon, { color: trendColor }]}>{trendIcon}</Text>
            <Text style={[styles.trendValue, { color: trendColor }]}>
              {Math.abs(latest - previous).toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', height: 150, marginTop: Spacing.sm }}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          {yLabels.map((v, i) => (
            <Text key={i} style={styles.yLabel}>{v}</Text>
          ))}
        </View>
        {/* Chart area */}
        <View style={styles.chartArea}>
          {/* Grid lines */}
          {yLabels.map((_, i) => (
            <View key={i} style={styles.gridLine} />
          ))}

          {/* Connected SVG curved Line & Gradient Area */}
          {data.length > 1 && (
            <View style={StyleSheet.absoluteFill}>
              <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <Defs>
                  <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={color} stopOpacity="0.22" />
                    <Stop offset="100%" stopColor={color} stopOpacity="0.0" />
                  </SvgLinearGradient>
                </Defs>

                {/* Shaded Area */}
                <Path d={areaD} fill={`url(#${gradientId})`} />

                {/* Curved Line */}
                <Path
                  d={pathD}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          )}

          {/* Data dots */}
          {coords.map((p, i) => {
            const isLatest = i === coords.length - 1;
            return (
              <View
                key={i}
                style={[
                  styles.dataDot,
                  {
                    left: `${p.x}%` as any,
                    top: `${p.y}%` as any,
                    width: isLatest ? 10 : 8,
                    height: isLatest ? 10 : 8,
                    borderRadius: isLatest ? 5 : 4,
                    marginLeft: isLatest ? -5 : -4,
                    marginTop: isLatest ? -5 : -4,
                    opacity: isLatest ? 1 : 0.8,
                    backgroundColor: color,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* X-axis date labels aligned under the dots */}
      <View style={styles.xAxis}>
        {data.map((p, i) => {
          const shouldShow =
            data.length <= 4 ||
            i === 0 ||
            i === data.length - 1 ||
            (data.length === 5 && i === 2) ||
            (data.length > 5 && i === Math.floor(data.length / 2));

          if (!shouldShow) return null;

          const xPct = data.length > 1 ? (i / (data.length - 1)) * 86 + 7 : 50;
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
                styles.xLabel,
                {
                  left: `${xPct}%` as any,
                  transform: [{ translateX: -20 }],
                  width: 40,
                  textAlign: 'center',
                },
              ]}
            >
              {dateFormatted}
            </Text>
          );
        })}
      </View>

      {(normalMin !== undefined || normalMax !== undefined) && (
        <Text style={styles.rangeHint}>
          Normal range: {normalMin ?? '—'}–{normalMax ?? '—'} {unit}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  title: {
    ...Typography.headlineSmall,
    color: Colors.text,
    fontWeight: '700',
  },
  unit: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  trendValue: {
    ...Typography.labelMedium,
    fontWeight: '700',
  },
  yAxis: {
    width: 28,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: Spacing.xs,
    paddingVertical: 10,
  },
  yLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  chartArea: {
    flex: 1,
    position: 'relative',
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  gridLine: {
    height: 1,
    backgroundColor: Colors.divider + '40',
    width: '100%',
  },
  dataDot: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: Colors.white,
    ...Shadow.sm,
  },
  xAxis: {
    flexDirection: 'row',
    height: 20,
    position: 'relative',
    marginLeft: 28,
    marginTop: Spacing.xs,
  },
  xLabel: {
    position: 'absolute',
    fontSize: 9,
    color: Colors.textMuted,
  },
  rangeHint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  emptySubtext: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: Radius.sm + 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
});

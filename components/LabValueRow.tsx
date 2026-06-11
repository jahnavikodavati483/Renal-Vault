import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { KidneyParameters } from '../types';
import { getParameterStatus, getParameterRange, PARAMETER_META } from '../utils/ckdAnalysis';

interface LabValueRowProps {
  paramKey: keyof KidneyParameters;
  value: number;
  sex: 'male' | 'female';
  onEdit: (key: keyof KidneyParameters, value: number) => void;
}

const STATUS_ICONS = {
  normal: { icon: 'checkmark-circle', color: Colors.success },
  high:   { icon: 'arrow-up-circle', color: Colors.danger },
  low:    { icon: 'arrow-down-circle', color: Colors.warning },
};

export function LabValueRow({ paramKey, value, sex, onEdit }: LabValueRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toString());

  const meta = PARAMETER_META[paramKey];
  if (!meta) return null;

  const status = getParameterStatus(paramKey, value, sex);
  const range = getParameterRange(paramKey, sex);
  const si = STATUS_ICONS[status];

  function commitEdit() {
    const n = parseFloat(draft);
    if (!isNaN(n) && n > 0) onEdit(paramKey, n);
    setEditing(false);
  }

  return (
    <View style={[styles.row, status !== 'normal' && styles.rowAbnormal]}>
      {/* Status icon */}
      <View style={styles.iconCol}>
        <Ionicons name={si.icon as any} size={18} color={si.color} />
      </View>

      {/* Test name */}
      <View style={styles.nameCol}>
        <Text style={styles.name}>{meta.label}</Text>
        {range && (
          <Text style={styles.range}>
            Ref: {range.min}–{range.max} {meta.unit}
          </Text>
        )}
      </View>

      {/* Value */}
      <View style={styles.valueCol}>
        {editing ? (
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            autoFocus
            onBlur={commitEdit}
            onSubmitEditing={commitEdit}
            selectTextOnFocus
          />
        ) : (
          <Text style={[styles.value, { color: si.color }]}>
            {Number.isInteger(value) ? value : value.toFixed(2)}
          </Text>
        )}
        <Text style={styles.unit}>{meta.unit}</Text>
      </View>

      {/* Status badge */}
      <View style={[styles.badge, { backgroundColor: si.color + '18' }]}>
        <Text style={[styles.badgeText, { color: si.color }]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>
      </View>

      {/* Edit button */}
      <TouchableOpacity onPress={() => { setEditing(!editing); setDraft(value.toString()); }} style={styles.editBtn}>
        <Ionicons name={editing ? 'checkmark' : 'pencil'} size={14} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  rowAbnormal: {
    backgroundColor: '#FAFBFF',
  },
  iconCol: { width: 22 },
  nameCol: { flex: 1 },
  name: { ...Typography.labelLarge, color: Colors.text },
  range: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 1 },
  valueCol: { alignItems: 'flex-end', minWidth: 70 },
  value: { fontSize: 17, fontWeight: '700', lineHeight: 20 },
  unit: { ...Typography.bodySmall, color: Colors.textMuted },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.primary,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    minWidth: 60,
    textAlign: 'right',
    paddingVertical: 2,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    minWidth: 52,
    alignItems: 'center',
  },
  badgeText: { ...Typography.labelSmall, fontWeight: '700' },
  editBtn: { padding: 6 },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function LabelSummary({
  source,
  tokens,
  serving,
  quality,
  colors
}: {
  source?: string;
  tokens?: number;
  serving?: string | null;
  quality: 'good' | 'partial' | 'ocr-only';
  colors: any;
}) {
  const pillBg =
    quality === 'good' ? (colors.mint || '#B6F6C8') :
    quality === 'partial' ? (colors.honey || '#FFD700') :
    (colors.peach || '#FFAB7A');

  return (
    <View style={[styles.row, { borderColor: colors.border || '#E5E7EB' }]}>
      <Text style={[styles.kv, { color: colors.textSecondary }]}>Source: <Text style={styles.kvStrong}>{source || '—'}</Text></Text>
      <Text style={[styles.kv, { color: colors.textSecondary }]}>Tokens: <Text style={styles.kvStrong}>{tokens ?? 0}</Text></Text>
      <Text style={[styles.kv, { color: colors.textSecondary }]}>Serving: <Text style={styles.kvStrong}>{serving || '—'}</Text></Text>
      <View style={[styles.pill, { backgroundColor: pillBg }]}><Text style={styles.pillText}>{quality}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  kv: { fontSize: 12 },
  kvStrong: { fontWeight: '600' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '700' }
});
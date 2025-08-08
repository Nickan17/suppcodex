import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function RubricBullets({
  title, bullets, colors
}: { title: string; bullets: string[]; colors: any }) {
  if (!bullets?.length) return null;
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface || '#fff', borderColor: colors.border || '#E5E7EB' }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {bullets.map((b, i) => (
        <Text key={i} style={[styles.item, { color: colors.textSecondary }]}>• {b}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  title: { fontWeight: '700', marginBottom: 6 },
  item: { fontSize: 13, marginVertical: 2 }
});
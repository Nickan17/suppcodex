import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function IngredientChips({ items, colors }: { items: string[]; colors: any }) {
  const shown = items.slice(0, 6);
  const more = Math.max(0, items.length - shown.length);
  return (
    <View style={styles.wrap}>
      {shown.map((i, idx) => (
        <View key={idx} style={[styles.chip, { borderColor: colors.border || '#E5E7EB', backgroundColor: colors.surface || '#fff' }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{i}</Text>
        </View>
      ))}
      {more > 0 && (
        <View style={[styles.chip, { borderColor: colors.border || '#E5E7EB', backgroundColor: colors.surface || '#fff' }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>+{more} more</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 }
});
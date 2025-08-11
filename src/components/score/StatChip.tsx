import React from 'react';
import { View, Text } from 'react-native';

export default function StatChip({ icon, label, value, tone = 'green', colors }: { icon: React.ReactNode; label: string; value?: number | null; tone: 'green'|'purple'|'red'|'gold'; colors: any }) {
  const bgMap: Record<string, string> = {
    green: colors.mint,
    purple: colors.seafoam,
    red: colors.peach,
    gold: colors.honey,
  };
  const bg = bgMap[tone] || colors.surface;
  const isNA = !(typeof value === 'number' && isFinite(value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10, opacity: isNA ? 0.6 : 1 }} accessibilityRole="text" accessibilityLabel={isNA ? 'Not available' : `${label} ${Math.round(value || 0)} out of 100`}>
      <View>{icon}</View>
      <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{label}</Text>
      <Text style={{ color: colors.textPrimary }}>{isNA ? 'N/A' : Math.round(value!)}</Text>
    </View>
  );
} 
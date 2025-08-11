import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function SegmentedTabs({
  tabs,
  activeKey,
  onChange,
  colors,
}: {
  tabs: { key: string; label: string }[];
  activeKey: string;
  onChange: (key: string) => void;
  colors: any;
}) {
  return (
    <View style={{ flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: colors.border, padding: 4, marginHorizontal: 16, marginTop: 12 }}>
      {tabs.map(t => {
        const active = t.key === activeKey;
        return (
          <TouchableOpacity
            key={t.key}
            accessibilityRole="button"
            accessibilityLabel={`Show ${t.label}`}
            onPress={() => onChange(t.key)}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: active ? colors.surface : 'transparent',
            }}
          >
            <Text style={{ textAlign: 'center', color: active ? colors.textPrimary : colors.textSecondary, fontWeight: active ? '700' : '500' }}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
} 
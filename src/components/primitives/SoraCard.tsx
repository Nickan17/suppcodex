import React from 'react';
import { View } from 'react-native';

export default function SoraCard({ children, colors, style }: { children: React.ReactNode; colors: any; style?: any }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        marginHorizontal: 16,
        marginTop: 12,
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
        ...(style || {}),
      }}
    >
      {children}
    </View>
  );
} 
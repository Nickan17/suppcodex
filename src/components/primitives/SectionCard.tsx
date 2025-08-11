import React from 'react';
import { View, Text } from 'react-native';

export default function SectionCard({
  title,
  children,
  colors,
  style,
}: {
  title: string;
  children: React.ReactNode;
  colors: any;
  style?: any;
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginTop: 12,
        shadowOpacity: 0.07,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
        ...(style || {}),
      }}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: colors.textPrimary,
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
} 
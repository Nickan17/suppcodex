import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '@/design-system/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: keyof typeof import('@/design-system/tokens').spacing;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  style,
  padding = 4
}) => {
  const { colors, spacing, radii } = useTheme();

  const cardStyles: ViewStyle = {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing[padding],
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  };

  return (
    <View style={[cardStyles, style]}>
      {children}
    </View>
  );
};
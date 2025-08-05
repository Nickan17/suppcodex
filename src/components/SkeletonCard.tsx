import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/design-system/theme/useTheme';
import Colors from '@/constants/Colors';

type Props = { height?: number; width?: number; style?: any };

const SkeletonCard: React.FC<Props> = ({ height = 100, width = '100%', style }) => {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <View 
      style={[
        styles.skeleton, 
        { 
          height, 
          width, 
          backgroundColor: colors.backgroundTertiary 
        },
        style
      ]} 
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    borderRadius: 8,
    opacity: 0.6,
  },
});

export default SkeletonCard; 
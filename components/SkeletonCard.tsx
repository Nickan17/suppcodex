import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

type Props = { height?: number; width?: number; style?: any };

const SkeletonCard: React.FC<Props> = ({ height = 100, width = '100%', style }) => {
  const { colors } = useTheme();

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
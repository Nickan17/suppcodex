import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/design-system/theme';

interface BannerProps {
  kind: 'warning' | 'info';
  text: string;
}

const Banner: React.FC<BannerProps> = ({ kind, text }) => {
  const { colors } = useTheme();

  const containerStyle = {
    backgroundColor: kind === 'warning' ? `${colors.peach}40` : `${colors.seafoam}40`,
    borderColor: kind === 'warning' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(124, 199, 163, 0.3)',
  };

  const textStyle = {
    color: kind === 'warning' ? colors.semantic?.warning : colors.semantic?.info,
  };

  return (
    <View style={[styles.warningBanner, containerStyle]}>
      <Text style={[styles.warningText, textStyle]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  warningBanner: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  warningText: {
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default Banner;
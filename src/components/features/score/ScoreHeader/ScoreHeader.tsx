import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScoreRing from '@/components/ui/ScoreRing';
import { useTheme } from '@/design-system/theme';

interface ScoreHeaderProps {
  score: number;
  productName: string;
  subtitle?: string;
}

const ScoreHeader: React.FC<ScoreHeaderProps> = ({
  score,
  productName,
  subtitle = "Nature does not hurry, yet everything is accomplished.",
}) => {
  console.log('ScoreHeader dependency types:', {
    ScoreRing: typeof ScoreRing,
    useTheme: typeof useTheme,
    React: typeof React,
    View: typeof View,
    Text: typeof Text,
    StyleSheet: typeof StyleSheet
  });
  
  const { colors, fonts, spacing } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.subtitle, { 
        fontFamily: fonts.body.family, 
        color: colors.textPrimary,
        marginBottom: spacing[6]
      }]}>
        {subtitle}
      </Text>
      
      <View style={[styles.scoreContainer, { marginBottom: spacing[4] }]}>
        <ScoreRing size={200} value={score} />
      </View>
      
      <Text style={[styles.productName, { 
        fontFamily: fonts.body.family, 
        color: colors.textPrimary
      }]}>
        {productName}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 24,
    paddingHorizontal: 32,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  productName: {
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.8,
  },
});

export default ScoreHeader;
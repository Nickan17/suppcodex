import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScoreRing from '../../../ui/ScoreRing/ScoreRing';
import { useTheme } from '../../../../design-system/theme';

interface ScoreHeaderProps {
  title: string;
  score: number;
  grade?: string;
  subtitle?: string;
  ringColor?: string;
  onDebugPress?: () => void;
}

const ScoreHeader: React.FC<ScoreHeaderProps> = ({
  title,
  score,
  grade,
  subtitle = "Nature does not hurry, yet everything is accomplished.",
  ringColor,
  onDebugPress,
}) => {
  console.log('ScoreHeader deps:', {
    ScoreRing: typeof ScoreRing,
    useTheme: typeof useTheme,
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
        <ScoreRing 
          size={200} 
          score={score === 0 ? null : score} 
          progressColor={ringColor}
          grade={grade || (score === 0 ? '—' : String(score))}
        />
      </View>
      
      <Text style={[styles.productName, { 
        fontFamily: fonts.body.family, 
        color: colors.textPrimary
      }]}>
        {title}
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
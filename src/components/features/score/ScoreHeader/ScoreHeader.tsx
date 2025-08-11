import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScoreRing from '../../../ui/ScoreRing/ScoreRing';
import { useTheme } from '../../../../design-system/theme';
import { getGrade } from '../../../../utils/getGrade';

interface ScoreHeaderProps {
  title: string;
  score: number | null;
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
  const { colors, fonts, spacing } = useTheme();
  const effectiveGrade = grade ?? getGrade(score);

  return (
    <View style={styles.container}>
      <Text style={[styles.subtitle, { 
        fontFamily: fonts.body.family, 
        color: colors.textPrimary,
        marginBottom: spacing[6]
      }]} 
        numberOfLines={2}
      >
        {subtitle}
      </Text>
      
      <View style={[styles.scoreContainer, { marginBottom: spacing[4] }]}>
        <ScoreRing 
          size={200} 
          score={score}
          progressColor={ringColor}
          grade={effectiveGrade}
        />
      </View>
      
      <Text style={[styles.productName, { 
        fontFamily: fonts.body.family, 
        color: colors.textPrimary
      }]} 
        numberOfLines={1}
      >
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
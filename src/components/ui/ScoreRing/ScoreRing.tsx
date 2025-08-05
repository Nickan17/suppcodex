import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/design-system/theme';

interface ScoreRingProps {
  size: number;
  value: number; // 0-100
  label?: string;
  strokeWidth?: number;
}

const ScoreRing: React.FC<ScoreRingProps> = ({
  size,
  value,
  label,
  strokeWidth = 8,
}) => {
  const { colors, fonts } = useTheme();
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  
  const center = size / 2;

  const getGradeText = () => {
    if (value >= 95) return 'A+';
    if (value >= 90) return 'A';
    if (value >= 85) return 'A-';
    if (value >= 80) return 'B+';
    if (value >= 75) return 'B';
    if (value >= 70) return 'B-';
    if (value >= 65) return 'C+';
    if (value >= 60) return 'C';
    return 'D';
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.mint} />
            <Stop offset="100%" stopColor={colors.peach} />
          </LinearGradient>
        </Defs>
        
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.overlay}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        
        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#scoreGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      
      <View style={styles.content}>
        <Text style={[styles.grade, { fontFamily: fonts.heading.family, color: colors.textPrimary }]}>
          {getGradeText()}
        </Text>
        <Text style={[styles.score, { fontFamily: fonts.body.family, color: colors.textPrimary }]}>
          {value} / 100
        </Text>
        {label && (
          <Text style={[styles.label, { fontFamily: fonts.body.family, color: colors.textPrimary }]}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grade: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  score: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default ScoreRing;
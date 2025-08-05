import React from 'react';
import { View, StyleSheet } from 'react-native';
import MetricChip from '../MetricChip/MetricChip';
import Card from '@/components/ui/Card';
import StatusChip from '@/components/ui/StatusChip';
import { useTheme } from '@/design-system/theme';

interface ScoreData {
  purity: number;
  effectiveness: number;
  safety: number;
  value: number;
}

interface ScoreGridProps {
  scores: ScoreData;
}

const ScoreGrid: React.FC<ScoreGridProps> = ({ scores }) => {
  console.log('ScoreGrid dependency types:', {
    MetricChip: typeof MetricChip,
    Card: typeof Card,
    StatusChip: typeof StatusChip,
    useTheme: typeof useTheme,
    React: typeof React,
    View: typeof View,
    StyleSheet: typeof StyleSheet
  });
  
  const { colors, spacing } = useTheme();

  const metrics = [
    {
      key: 'purity',
      icon: '🍃',
      label: 'Purity',
      value: scores.purity,
      color: colors.mint,
      badgeEmoji: '✨',
    },
    {
      key: 'effectiveness',
      icon: '🔮',
      label: 'Effectiveness',
      value: scores.effectiveness,
      color: colors.lavender,
      badgeEmoji: '⚡',
    },
    {
      key: 'safety',
      icon: '🛡️',
      label: 'Safety',
      value: scores.safety,
      color: colors.peach,
      badgeEmoji: '🛡️',
    },
    {
      key: 'value',
      icon: '💰',
      label: 'Value',
      value: scores.value,
      color: colors.honey,
      badgeEmoji: '💎',
    },
  ];

  return (
    <View style={[styles.container, { gap: spacing[2] }]}>
      <View style={[styles.row, { gap: spacing[2] }]}>
        <View style={styles.chip}>
          <MetricChip {...metrics[0]} />
        </View>
        <View style={styles.chip}>
          <MetricChip {...metrics[1]} />
        </View>
      </View>
      <View style={[styles.row, { gap: spacing[2] }]}>
        <View style={styles.chip}>
          <MetricChip {...metrics[2]} />
        </View>
        <View style={styles.chip}>
          <MetricChip {...metrics[3]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
  },
  chip: {
    flex: 1,
  },
});

export default ScoreGrid;
import React from 'react';
import { View, StyleSheet } from 'react-native';
import MetricChip from '../MetricChip/MetricChip.tsx';
import Card from '@/components/ui/Card';
import StatusChip from '@/components/ui/StatusChip';
import { useTheme } from '@/design-system/theme';
import { omit } from 'lodash';

interface ScoreData {
  purity: number;
  effectiveness: number;
  safety: number;
  value: number;
}

interface ScoreGridProps {
  scores: ScoreData;
}

const safeValue = (v: unknown) =>
  (typeof v === 'number' && isFinite(v)) ? v : null;

const ScoreGrid: React.FC<ScoreGridProps> = ({ scores }) => {
  const { colors, spacing } = useTheme();

  const metrics = [
    {
      id: 'purity',
      icon: '🍃',
      label: 'Purity',
      value: scores.purity,
      color: colors.mint,
      badgeEmoji: '✨',
    },
    {
      id: 'effectiveness',
      icon: '🔮',
      label: 'Effectiveness',
      value: scores.effectiveness,
      color: colors.lavender,
      badgeEmoji: '⚡',
    },
    {
      id: 'safety',
      icon: '🛡️',
      label: 'Safety',
      value: scores.safety,
      color: colors.peach,
      badgeEmoji: '🛡️',
    },
    {
      id: 'value',
      icon: '💰',
      label: 'Value',
      value: scores.value,
      color: colors.honey,
      badgeEmoji: '💎',
    },
  ];

  return (
    <View style={[styles.container, { gap: spacing }]}>
      <View style={[styles.row, { gap: spacing }]}>
        {metrics.slice(0, 2).map((m, i) => (
          <View key={m.id ?? i} style={styles.chip}>
            <MetricChip
              icon={m.icon}
              label={m.label}
              value={safeValue(m.value)}
              color={m.color}
              badgeEmoji={m.badgeEmoji}
            />
          </View>
        ))}
      </View>
      <View style={[styles.row, { gap: spacing }]}>
        {metrics.slice(2, 4).map((m, i) => (
          <View key={m.id ?? i} style={styles.chip}>
            <MetricChip
              icon={m.icon}
              label={m.label}
              value={safeValue(m.value)}
              color={m.color}
              badgeEmoji={m.badgeEmoji}
            />
          </View>
        ))}
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
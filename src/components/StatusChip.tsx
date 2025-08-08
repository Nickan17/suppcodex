import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../design-system/theme';
import Colors from '../constants/Colors';

type Status = 'success' | 'parser_fail' | 'blocked_by_site' | 'manual';

interface Props {
  status: Status;
}

const StatusChip = ({ status }: Props) => {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const color = {
    success: colors.goodScore,
    parser_fail: colors.mediumScore,
    blocked_by_site: colors.badScore,
    manual: colors.mediumScore,
  }[status];
  const label = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  return (
    <View style={[styles.chip, { backgroundColor: color }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  text: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
});

export default StatusChip; 
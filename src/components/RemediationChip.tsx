import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../design-system/theme';
import Colors from '../constants/Colors';

interface Props {
  remediation: string;
}

const RemediationChip = ({ remediation }: Props) => {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  
  return (
    <View style={[styles.chip, { backgroundColor: colors.textTertiary }]}>
      <Text style={styles.text}>{remediation}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  text: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
});

export default RemediationChip; 
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '@/design-system/theme/useTheme';
import Colors from '@/constants/Colors';
import CertificationsBar from './CertificationsBar';

type Props = { facts: string; certifications?: string[] };

const SupplementFactsTable: React.FC<Props> = ({ facts, certifications }) => {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const lines = facts.split('\n').filter(line => line.trim());
  const isNarrow = Dimensions.get('window').width < 360;

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <Text style={[styles.title, { color: colors.text }]}>Supplement Facts</Text>
      <View style={[styles.grid, isNarrow && styles.gridNarrow]}>
        {lines.map((line, index) => (
          <View key={index} style={styles.cell}>
            <Text style={[styles.text, { color: colors.text }]}>{line}</Text>
          </View>
        ))}
      </View>
      <CertificationsBar certifications={certifications} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 12, marginVertical: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridNarrow: { flexDirection: 'column' },
  cell: { width: '50%', padding: 8 },
  text: { fontSize: 14 },
});

export default SupplementFactsTable; 
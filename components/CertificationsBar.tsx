import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/design-system/theme/useTheme';
import Colors from '@/constants/Colors';
import { Shield, Leaf, Star, Award } from 'lucide-react-native';

type Props = { certifications?: string[] };

const CertificationsBar: React.FC<Props> = ({ certifications = [] }) => {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const hasCertifications = certifications.length > 0;

  const getIcon = (cert: string) => {
    const lower = cert.toLowerCase();
    if (lower.includes('organic')) return Leaf;
    if (lower.includes('premium')) return Star;
    if (lower.includes('award')) return Award;
    return Shield;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        Certifications
      </Text>
      <View style={styles.chipRow}>
        {hasCertifications ? (
          certifications.map((cert, index) => {
            const Icon = getIcon(cert);
            return (
              <View key={index} style={[styles.chip, { backgroundColor: colors.primaryLight }]}>
                <Icon size={16} color={colors.primary} />
                <Text style={[styles.chipText, { color: colors.primary }]}>{cert}</Text>
              </View>
            );
          })
        ) : (
          <View style={[styles.emptyChip, { backgroundColor: colors.backgroundTertiary }]}>
            <Shield size={16} color={colors.textTertiary} />
            <Text style={[styles.chipText, { color: colors.textTertiary }]}>No certifications</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  title: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6 },
  emptyChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6 },
  chipText: { fontSize: 12, fontWeight: '500' },
});

export default CertificationsBar; 
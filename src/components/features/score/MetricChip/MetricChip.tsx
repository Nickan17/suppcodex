import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from '@/components/ui/Card';
import { useTheme } from '@/design-system/theme';

interface MetricChipProps {
  icon: string;
  label: string;
  value: number;
  color: string;
  badgeEmoji?: string;
}

const MetricChip: React.FC<MetricChipProps> = ({
  icon,
  label,
  value,
  color,
  badgeEmoji,
}) => {
  const { colors, fonts, radii } = useTheme();

  return (
    <Card style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={[styles.icon, { fontSize: 48 }]}>{icon}</Text>
          <Text style={[styles.label, { 
            fontFamily: fonts.body.family,
            color: colors.textPrimary 
          }]}>
            {label}
          </Text>
        </View>
        
        <View style={styles.valueContainer}>
          <Text style={[styles.value, { 
            fontFamily: fonts.heading.family,
            color: colors.textPrimary 
          }]}>
            {value}
          </Text>
          {badgeEmoji && (
            <Text style={styles.badge}>{badgeEmoji}</Text>
          )}
        </View>
      </View>
      
      <View style={[styles.progressBar, { backgroundColor: colors.overlay }]}>
        <View 
          style={[
            styles.progressFill, 
            { 
              backgroundColor: color,
              width: `${value}%`,
              borderRadius: radii.xs,
            }
          ]} 
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 120,
    padding: 16,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    textAlign: 'center',
  },
  valueContainer: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  value: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  badge: {
    fontSize: 20,
    marginLeft: 4,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
  },
});

export default MetricChip;
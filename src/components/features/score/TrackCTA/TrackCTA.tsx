import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useTheme } from '@/design-system/theme';

interface TrackCTAProps {
  onAddToStack: () => void;
}

const TrackCTA: React.FC<TrackCTAProps> = ({ onAddToStack }) => {
  const { colors, fonts, spacing } = useTheme();

  return (
    <Card style={[styles.container, { marginHorizontal: spacing[4] }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.icon}>🦋</Text>
          <Text style={[styles.title, { 
            fontFamily: fonts.heading.family,
            color: colors.textPrimary 
          }]}>
            Track Your Daily Supps
          </Text>
        </View>
        
        <Button
          title="Add to My Stack"
          variant="primary"
          onPress={onAddToStack}
          fullWidth
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    marginVertical: 16,
  },
  content: {
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default TrackCTA;
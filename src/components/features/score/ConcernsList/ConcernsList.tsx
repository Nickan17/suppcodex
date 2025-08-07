import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ConcernsListProps {
  items?: string[];
  loading?: boolean;
}

export default function ConcernsList({ items = [] }: ConcernsListProps) {
  const hasItems = items.length > 0;
  
  return (
    <View style={[styles.container, { backgroundColor: '#242528', borderRadius: 14, padding: 14, marginHorizontal: 16, marginTop: 8 }]}>
      {hasItems ? items.slice(0, 5).map((item, index) => (
        <View key={index} style={styles.itemRow}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={[styles.itemText, { color: '#F4F5F6' }]}>{item}</Text>
        </View>
      )) : (
        <Text style={[styles.emptyText, { color: '#BFC3C9' }]}>
          No concerns identified for this supplement
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  emoji: {
    marginRight: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
});
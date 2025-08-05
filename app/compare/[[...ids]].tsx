import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/design-system/theme/useTheme';
import Colors from '@/constants/Colors';
import Typography from '@/components/ui/Typography';
import SupplementFactsTable from '@/components/SupplementFactsTable';

export default function CompareView() {
  const { ids } = useLocalSearchParams<{ ids: string[] }>();
  const { isDark } = useTheme();
  
  if (!ids || ids.length !== 2) {
    return (
      <View style={[styles.container, { backgroundColor: Colors[isDark ? 'dark' : 'light'].background }]}>
        <Typography variant="h1" style={styles.title}>Compare Products</Typography>
        <Typography variant="body">Select two products to compare</Typography>
      </View>
    );
  }

  const [id1, id2] = ids;
  
  // Mock data - in real app, fetch from API
  const product1 = {
    id: id1,
    name: 'Product A',
    facts: 'Serving Size: 1 Capsule\nAmount Per Serving: Calories 10\nTotal Fat 1g\nVitamin D 25mcg',
    certifications: ['USDA Organic'],
    score: 85
  };
  
  const product2 = {
    id: id2,
    name: 'Product B', 
    facts: 'Serving Size: 2 Capsules\nAmount Per Serving: Calories 15\nTotal Fat 2g\nVitamin D 50mcg',
    certifications: ['Non-GMO'],
    score: 92
  };

  const scoreDiff = product2.score - product1.score;
  const scoreDiffPercent = Math.round((scoreDiff / product1.score) * 100);

  return (
    <ScrollView style={[styles.container, { backgroundColor: Colors[isDark ? 'dark' : 'light'].background }]}>
      <Typography variant="h1" style={styles.title}>Compare Products</Typography>
      
      <View style={styles.comparisonContainer}>
        <View style={styles.productColumn}>
          <Typography variant="h2" style={styles.productName}>{product1.name}</Typography>
          <SupplementFactsTable 
            facts={product1.facts}
            certifications={product1.certifications}
          />
          <View style={styles.scoreContainer}>
            <Typography variant="h3">Score: {product1.score}</Typography>
          </View>
        </View>
        
        <View style={styles.vsContainer}>
          <Typography variant="h2" style={styles.vsText}>VS</Typography>
          {scoreDiff !== 0 && (
            <View style={[styles.deltaBadge, { backgroundColor: scoreDiff > 0 ? '#10b981' : '#ef4444' }]}>
              <Typography variant="body" style={styles.deltaText}>
                {scoreDiff > 0 ? '+' : ''}{scoreDiffPercent}%
              </Typography>
            </View>
          )}
        </View>
        
        <View style={styles.productColumn}>
          <Typography variant="h2" style={styles.productName}>{product2.name}</Typography>
          <SupplementFactsTable 
            facts={product2.facts}
            certifications={product2.certifications}
          />
          <View style={styles.scoreContainer}>
            <Typography variant="h3">Score: {product2.score}</Typography>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
  },
  comparisonContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  productColumn: {
    flex: 1,
  },
  vsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  vsText: {
    marginBottom: 8,
  },
  deltaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deltaText: {
    color: 'white',
    fontWeight: 'bold',
  },
  productName: {
    marginBottom: 12,
    textAlign: 'center',
  },
  scoreContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
}); 
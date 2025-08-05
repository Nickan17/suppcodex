import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { PillTab } from '@/components/ui';
import { ScoreHeader, ScoreGrid, TrackCTA, BottomNav } from '@/components/features/score';

const mockScores = {
  purity: 93,
  effectiveness: 88,
  safety: 90,
  value: 91,
};

const mockProductName = "Magnum Quattro Whey Protein - Chocolate";

export default function ScoreScreen() {
  console.log('MOUNT ScoreScreen v1');
  console.log('Component types:', {
    PillTab: typeof PillTab,
    ScoreHeader: typeof ScoreHeader,
    ScoreGrid: typeof ScoreGrid,
    TrackCTA: typeof TrackCTA,
    BottomNav: typeof BottomNav
  });
  const { colors, spacing } = useTheme();
  const [selectedTab, setSelectedTab] = useState('Score');

  const tabs = ['Score', 'Parsed', 'Raw', 'Meta'];
  const overallScore = Math.round((mockScores.purity + mockScores.effectiveness + mockScores.safety + mockScores.value) / 4);

  const navItems = [
    { icon: '🏠', label: 'Home', onPress: () => console.log('Home') },
    { icon: '📷', label: 'Scan', onPress: () => console.log('Scan') },
    { icon: '📚', label: 'Library', onPress: () => console.log('Library') },
    { icon: '📊', label: 'Insights', onPress: () => console.log('Insights') },
    { icon: '👤', label: 'Profile', onPress: () => console.log('Profile') },
  ];

  const handleAddToStack = () => {
    console.log('Added to stack');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>SuppCodex</Text>
          <Text style={styles.searchIcon}>🔍</Text>
        </View>

        <ScoreHeader 
          score={overallScore} 
          productName={mockProductName}
        />

        <View style={[styles.tabContainer, { 
          marginHorizontal: spacing[4], 
          marginBottom: spacing[6] 
        }]}>
          <View style={styles.tabs}>
            {tabs.map((tab) => (
              <PillTab
                key={tab}
                title={tab}
                isSelected={selectedTab === tab}
                onPress={() => setSelectedTab(tab)}
                style={{ flex: 1 }}
              />
            ))}
          </View>
        </View>

        {selectedTab === 'Score' && (
          <>
            <View style={styles.sectionTitle}>
              <Text style={[styles.sectionTitleText, { 
                fontFamily: 'SFProRounded-Bold',
                color: colors.textPrimary 
              }]}>
                Score Details
              </Text>
            </View>

            <ScoreGrid scores={mockScores} />

            <TrackCTA onAddToStack={handleAddToStack} />
          </>
        )}
      </ScrollView>

      <BottomNav items={navItems} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D4A574', // Gold color from design
  },
  searchIcon: {
    fontSize: 24,
  },
  tabContainer: {
    paddingHorizontal: 0,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 40,
    padding: 4,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitleText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
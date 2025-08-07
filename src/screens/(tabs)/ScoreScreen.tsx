import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/design-system/theme';
import { useProduct } from '@/contexts/ProductContext';
import { toGrade } from '@/utils/toGrade';
import ScoreHeader from '@/components/features/score/ScoreHeader/ScoreHeader';
import HighlightsList from '@/components/features/score/HighlightsList/HighlightsList';
import ConcernsList from '@/components/features/score/ConcernsList/ConcernsList';
import ScoreGrid from '@/components/features/score/ScoreGrid/ScoreGrid';
import TrackCTA from '@/components/features/score/TrackCTA/TrackCTA';
import DebugDrawer from '@/components/features/score/DebugDrawer/DebugDrawer';
import ScoreCelebration from '@/components/features/score/ScoreCelebration/ScoreCelebration';

export default function ScoreScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { current } = useProduct();
  const { colors } = useTheme();
  const [showDebug, setShowDebug] = useState(false);

  // Dev mode check
  const isDev = __DEV__ || process.env.EXPO_PUBLIC_USE_MOCK === '1';

  if (!current) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
            Analyzing…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Extract data defensively
  const score = Number.isFinite(current.score?.score) ? current.score.score : 0;
  const title = current.product?.title || 'Unknown Product';
  const highlights = Array.isArray(current.score?.highlights) ? current.score.highlights : [];
  const concerns = Array.isArray(current.score?.concerns) ? current.score.concerns : [];
  const grade = toGrade(score);
  
  // Only show service unavailable banner when scorer actually failed (not weak extraction)
  const showServiceUnavailable = Boolean(current.meta?.score?.error);

  const handleDebugPress = () => {
    if (isDev) {
      setShowDebug(true);
    }
  };

  const handleAddToStack = () => {
    Alert.alert(
      'Added to Stack! 🎉',
      `${title} has been added to your wellness stack.`,
      [{ text: 'Great!', style: 'default' }]
    );
  };

  const getGradeMessage = (grade: string): string => {
    if (grade === 'A+' || grade === 'A') return 'Excellent choice! 🌟';
    if (grade.startsWith('A') || grade.startsWith('B')) return 'Great pick! 🌱';
    if (grade.startsWith('C')) return 'Decent option 👍';
    if (grade.startsWith('D')) return 'Worth reviewing 🤔';
    if (grade === '—') return 'Analysis complete';
    return 'Heads up — this might not be the cleanest option 💭';
  };

  const getScoreRingColor = (grade: string): string => {
    if (grade === '—') return colors.border || '#E5E7EB';
    if (grade === 'A+' || grade === 'A') return colors.mint || '#B6F6C8';
    if (grade.startsWith('A') || grade.startsWith('B')) return colors.seafoam || '#A8E6CF';
    if (grade.startsWith('C')) return colors.honey || '#FFD700';
    if (grade.startsWith('D')) return colors.peach || '#FFAB7A';
    return '#FF8A7A'; // Soft red for F
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Celebration for high scores */}
      {score >= 90 && <ScoreCelebration fire={true} />}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backButton, { color: colors.textPrimary }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.gold || '#D4A574' }]}>
            SuppCodex
          </Text>
          {isDev && (
            <TouchableOpacity onPress={handleDebugPress}>
              <Text style={[styles.debugButton, { color: colors.textSecondary }]}>⋯</Text>
            </TouchableOpacity>
          )}
          {!isDev && <View style={{ width: 24 }} />}
        </View>

        {/* Score Header */}
        <TouchableOpacity onPress={handleDebugPress} onLongPress={handleDebugPress}>
          <ScoreHeader
            title={title}
            score={score}
            grade={grade}
            subtitle={getGradeMessage(grade)}
            ringColor={getScoreRingColor(grade)}
            onDebugPress={isDev ? handleDebugPress : undefined}
          />
        </TouchableOpacity>

        {/* Scoring Unavailable Banner */}
        {showServiceUnavailable && (
          <View style={[styles.errorBanner, { backgroundColor: '#FDE7E3' }]}>
            <Text style={[styles.errorText, { color: '#7A2E22' }]}>
              Unable to analyze supplement — scoring service unavailable.
            </Text>
          </View>
        )}

        {/* Score Grid - only show if we have a valid score */}
        {score > 0 && (
          <ScoreGrid scores={{
            purity: Math.max(0, score - 5),
            effectiveness: Math.max(0, score - 3),
            safety: Math.max(0, score + 2),
            value: Math.max(0, score - 1)
          }} />
        )}

        {/* Highlights Section */}
        <Text style={[styles.sectionHeader, { color: colors.textPrimary || '#123926' }]}>
          What&apos;s great
        </Text>
        <HighlightsList items={highlights} />

        {/* Concerns Section */}
        <Text style={[styles.sectionHeader, { color: colors.textPrimary || '#123926' }]}>
          Worth a look
        </Text>
        <ConcernsList items={concerns} />

        {/* Actions */}
        <TrackCTA onAddToStack={handleAddToStack} />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Debug Drawer */}
      <DebugDrawer
        visible={isDev && showDebug}
        onClose={() => setShowDebug(false)}
        parsed={current.product}
        raw={current}
        logs={current.meta?.chain}
        meta={current.meta}
      />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  debugButton: {
    fontSize: 18,
    fontWeight: '600',
  },
  errorBanner: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
  },
});
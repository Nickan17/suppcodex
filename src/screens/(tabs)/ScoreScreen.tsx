import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../design-system/theme';
import { useProduct } from '../../contexts/ProductContext';
import { toGrade } from '../../utils/toGrade';
import { cleanProductTitle } from '../../utils/cleanProductTitle';
import { mapExtractAndScoreToNormalized, NormalizedScore, CertBadge } from '../../utils/scoreResult';
import ScoreHeader from '../../components/features/score/ScoreHeader/ScoreHeader';
import HighlightsList from '../../components/features/score/HighlightsList/HighlightsList';
import ConcernsList from '../../components/features/score/ConcernsList/ConcernsList';
import ScoreGrid from '../../components/features/score/ScoreGrid/ScoreGrid';
import TrackCTA from '../../components/features/score/TrackCTA/TrackCTA';
import DebugDrawer from '../../components/features/score/DebugDrawer/DebugDrawer';
import ScoreCelebration from '../../components/features/score/ScoreCelebration/ScoreCelebration';
import { LabelSummary } from '../../components/features/score/LabelSummary/LabelSummary';
import { RubricBullets } from '../../components/features/score/RubricBullets/RubricBullets';
import { IngredientChips } from '../../components/features/score/IngredientChips/IngredientChips';

export default function ScoreScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { current } = useProduct();
  const { colors } = useTheme();
  const [showDebug, setShowDebug] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);

  // Dev mode check
  const isDev = __DEV__ || process.env.EXPO_PUBLIC_USE_MOCK === '1';

  // Add timeout for loading state
  useEffect(() => {
    if (!current) {
      const timer = setTimeout(() => {
        setShowTimeout(true);
        console.log('[ScoreScreen] Loading timeout reached, showing timeout UI');
      }, 10000); // 10 second timeout

      return () => clearTimeout(timer);
    }
  }, [current]);

  if (!current) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          {!showTimeout ? (
            <>
              <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
                Analyzing…
              </Text>
              <Text style={[styles.loadingSubtext, { color: colors.textSecondary, marginTop: 8 }]}>
                This may take up to 30 seconds
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.loadingText, { color: colors.textPrimary }]}>
                Taking longer than expected
              </Text>
              <Text style={[styles.loadingSubtext, { color: colors.textSecondary, marginTop: 8 }]}>
                The analysis may be stuck or there may be a network issue
              </Text>
            </>
          )}
          
          <View style={{ marginTop: 32, gap: 16 }}>
            <TouchableOpacity 
              onPress={() => {
                console.log('[ScoreScreen] User pressed Go Back');
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/');
                }
              }} 
              style={[styles.actionButton, { borderColor: colors.textSecondary }]}
            >
              <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                ← Go Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => {
                console.log('[ScoreScreen] User pressed Go Home');
                router.replace('/');
              }} 
              style={[styles.actionButton, { backgroundColor: colors.primary || '#007AFF' }]}
            >
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                🏠 Go Home
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  let normalizedScore: NormalizedScore | null = null;
  if (current.product && current.score) {
    try {
      normalizedScore = mapExtractAndScoreToNormalized({
        extract: {
          title: current.product.title,
          ingredients: current.product.ingredients || [],
          supplementFacts: current.product.facts ? { raw: current.product.facts } : undefined,
          _meta: { 
            factsSource: current.meta?.factsSource, 
            factsTokens: current.meta?.factsTokens,
            servingSize: current.product?.servingSize || null,
            productType: current.meta?.productType || 'other'
          }
        },
        score: {
          score: current.score.score || 0,
          purity: current.score.purity || 0,
          effectiveness: current.score.effectiveness || 0,
          safety: current.score.safety || 0,
          value: current.score.value || 0,
          highlights: current.score.highlights || [],
          concerns: current.score.concerns || []
        }
      });
    } catch (error) {
      console.warn('Failed to normalize score data:', error);
    }
  }
  const score = normalizedScore?.score ?? 0;
  const title = normalizedScore?.displayTitle ?? cleanProductTitle(current.product?.title);
  const highlights = normalizedScore?.highlights ?? [];
  const concerns = normalizedScore?.concerns ?? [];
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

        {/* Label Summary */}
        {normalizedScore && (
          <LabelSummary
            source={normalizedScore.meta?.factsSource}
            tokens={normalizedScore.meta?.factsTokens}
            serving={normalizedScore.meta?.servingSize}
            quality={normalizedScore.dataQuality}
            colors={colors}
          />
        )}

        {/* Scoring Unavailable Banner */}
        {showServiceUnavailable && (
          <View style={[styles.errorBanner, { backgroundColor: '#FDE7E3' }]}>
            <Text style={[styles.errorText, { color: '#7A2E22' }]}>
              Unable to analyze supplement — scoring service unavailable.
            </Text>
          </View>
        )}

        {/* Certifications badges */}
        {normalizedScore?.certifications?.length ? (
          <View style={styles.certContainer}>
            {normalizedScore.certifications.map((cert) => (
              <CertificationBadge key={cert} badge={cert} colors={colors} />
            ))}
          </View>
        ) : null}

        {/* Mini Stats */}
        {normalizedScore && (
          <View style={styles.miniStatsContainer}>
            <MiniStat label="Purity" value={normalizedScore.purity} colors={colors} />
            <MiniStat label="Effectiveness" value={normalizedScore.effectiveness} colors={colors} />
            <MiniStat label="Safety" value={normalizedScore.safety} colors={colors} />
            <MiniStat label="Value" value={normalizedScore.value} colors={colors} />
          </View>
        )}

        {/* Rubric Bullets */}
        {normalizedScore?.rubric && (
          <>
            <RubricBullets title={`Purity (${normalizedScore.purity})`} bullets={normalizedScore.rubric.purity} colors={colors} />
            <RubricBullets title={`Effectiveness (${normalizedScore.effectiveness})`} bullets={normalizedScore.rubric.effectiveness} colors={colors} />
            <RubricBullets title={`Safety (${normalizedScore.safety})`} bullets={normalizedScore.rubric.safety} colors={colors} />
            <RubricBullets title={`Value (${normalizedScore.value})`} bullets={normalizedScore.rubric.value} colors={colors} />
          </>
        )}

        {/* Score Grid - only show if we have a valid score */}
        {score !== undefined && score !== null && (
          <ScoreGrid scores={{
            purity: Math.max(0, (score || 0) - 5),
            effectiveness: Math.max(0, (score || 0) - 3),
            safety: Math.max(0, (score || 0) + 2),
            value: Math.max(0, (score || 0) - 1)
          }} />
        )}

        {/* Highlights Section */}
        <Text style={[styles.sectionHeader, { color: colors.textPrimary || '#123926' }]}>
          What&apos;s great
        </Text>
        {highlights?.length ? (
          <HighlightsList items={highlights} />
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              Label text unreadable – no highlights.
            </Text>
          </View>
        )}

        {/* Concerns Section */}
        <Text style={[styles.sectionHeader, { color: colors.textPrimary || '#123926' }]}>
          Worth a look
        </Text>
        {concerns?.length ? (
          <ConcernsList items={concerns} />
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
              No significant concerns identified.
            </Text>
          </View>
        )}

        {/* Ingredients Section */}
        {normalizedScore?.ingredients?.length ? (
          <>
            <Text style={[styles.sectionHeader, { color: colors.textPrimary || '#123926' }]}>
              Ingredients
            </Text>
            <IngredientChips items={normalizedScore.ingredients} colors={colors} />
          </>
        ) : null}

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

// Helper Components
const MiniStat = ({ label, value, colors }: { label: string; value: number; colors: any }) => (
  <View style={[styles.miniStat, { borderColor: colors.border || '#E5E7EB' }]}>
    <Text style={[styles.miniStatValue, { color: colors.textPrimary }]}>{value}</Text>
    <Text style={[styles.miniStatLabel, { color: colors.textSecondary }]}>{label}</Text>
  </View>
);

const Card = ({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) => (
  <View style={[styles.card, { borderColor: colors.border || '#E5E7EB', backgroundColor: colors.surface || '#FFFFFF' }]}>
    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{title}</Text>
    {children}
  </View>
);

const CertificationBadge = ({ badge, colors }: { badge: CertBadge; colors: any }) => (
  <View style={[styles.certBadge, { backgroundColor: colors.mint || '#B6F6C8', borderColor: colors.mintBorder || '#A8E6CF' }]}>
    <Text style={[styles.certBadgeText, { color: colors.textPrimary }]}>{badge}</Text>
  </View>
);

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
  loadingSubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
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
  emptyState: {
    marginHorizontal: 16,
    padding: 12,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  miniStat: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 70,
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  miniStatLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  certBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  certBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  certContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 8,
    marginHorizontal: 16,
  },
  miniStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
    marginHorizontal: 16,
  },
  ingredientItem: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  ingredientMore: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});
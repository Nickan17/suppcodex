import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/design-system/theme';
import { useProduct } from '@/contexts/ProductContext';
import { toGrade } from '@/utils/toGrade';

export default function ScoreCheckScreen() {
  const { colors } = useTheme();
  const { setCurrent } = useProduct();
  const [score, setScore] = useState('75');
  const [title, setTitle] = useState('Test Supplement');
  const [highlights, setHighlights] = useState('High quality magnesium\nGood bioavailability\nThird-party tested');
  const [concerns, setConcerns] = useState('May cause digestive upset\nHigh dosage');

  const handleTestScore = () => {
    const scoreNum = Number(score) || 0;
    const highlightsArray = highlights.split('\n').filter(h => h.trim());
    const concernsArray = concerns.split('\n').filter(c => c.trim());
    
    const mockChainResult = {
      product: {
        id: 'test-product',
        title: title,
      },
      score: {
        score: scoreNum,
        highlights: highlightsArray,
        concerns: concernsArray,
      },
      meta: {
        chain: [
          { provider: 'dev-mock', status: 'success', ms: 100 }
        ],
        model: 'dev-test',
        scoredAt: new Date().toISOString(),
      }
    };

    setCurrent(mockChainResult);
    router.push('/(tabs)/score');
  };

  const testScenarios = [
    { name: 'Perfect Score', score: 100, highlights: ['Excellent quality\nPure ingredients\nThird-party tested'], concerns: [] },
    { name: 'Zero Score', score: 0, highlights: [], concerns: [] },
    { name: 'Low Score', score: 25, highlights: ['Contains some vitamins'], concerns: ['Multiple fillers\nPoor quality control\nNo testing data'] },
    { name: 'Empty Lists', score: 80, highlights: [], concerns: [] },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backButton, { color: colors.textPrimary }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Dev Score Checker
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Quick Scenarios */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Quick Tests</Text>
          {testScenarios.map((scenario, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.scenarioButton, { backgroundColor: colors.surface || '#F3F4F6' }]}
              onPress={() => {
                setScore(scenario.score.toString());
                setTitle(`${scenario.name} Test`);
                setHighlights(scenario.highlights.join('\n'));
                setConcerns(scenario.concerns.join('\n'));
              }}
            >
              <Text style={[styles.scenarioText, { color: colors.textPrimary }]}>
                {scenario.name} ({scenario.score})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Manual Input */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Manual Test</Text>
          
          <Text style={[styles.label, { color: colors.textSecondary }]}>Score (0-100)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface || '#F3F4F6', color: colors.textPrimary }]}
            value={score}
            onChangeText={setScore}
            placeholder="75"
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Product Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface || '#F3F4F6', color: colors.textPrimary }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Test Supplement"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Highlights (one per line)</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.surface || '#F3F4F6', color: colors.textPrimary }]}
            value={highlights}
            onChangeText={setHighlights}
            placeholder="Enter highlights..."
            multiline
            numberOfLines={4}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Concerns (one per line)</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.surface || '#F3F4F6', color: colors.textPrimary }]}
            value={concerns}
            onChangeText={setConcerns}
            placeholder="Enter concerns..."
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: colors.primary || '#007AFF' }]}
            onPress={handleTestScore}
          >
            <Text style={styles.testButtonText}>Test Score Screen</Text>
          </TouchableOpacity>
        </View>

        {/* Preview */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Preview</Text>
          <Text style={[styles.previewText, { color: colors.textSecondary }]}>
            Grade: {toGrade(Number(score) || 0)}
          </Text>
          <Text style={[styles.previewText, { color: colors.textSecondary }]}>
            Highlights: {highlights.split('\n').filter(h => h.trim()).length}
          </Text>
          <Text style={[styles.previewText, { color: colors.textSecondary }]}>
            Concerns: {concerns.split('\n').filter(c => c.trim()).length}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  backButton: {
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  scenarioButton: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  scenarioText: {
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 4,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  textArea: {
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  testButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  previewText: {
    fontSize: 12,
    marginBottom: 4,
  },
});
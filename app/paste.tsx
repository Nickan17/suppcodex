import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/design-system/theme/useTheme';
import Colors from '@/constants/Colors';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Toast from 'react-native-toast-message';
import SkeletonCard from '@/components/SkeletonCard';
import { chainExtractToScore } from '@/utils/chainExtractToScore';
import { useProductContext } from '@/contexts/ProductContext';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

interface AnalysisError {
  message: string;
  status?: number;
  chain?: Array<{
    provider: string;
    status: string;
    ms: number;
    code?: number;
    hint?: string;
  }>;
}

export default function PasteScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const { setProduct } = useProductContext();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState<AnalysisError | null>(null);

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    setUrl(text);
  };

  const handleSubmit = async () => {
    if (!url) {
      Toast.show({ type: 'error', text1: 'No URL', text2: 'Please paste a URL to continue.' });
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentStep('Starting analysis...');

    try {
      setCurrentStep('🔍 Extracting content...');
      const result = await chainExtractToScore(url);

      if (!result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError({
          message: result.error?.message || 'Could not parse content from URL.',
          status: result.error?.status,
          chain: result._meta?.chain,
        });
        setCurrentStep('');
        return;
      }

      // On success, store the complete result and navigate
      setProduct(result);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/score/[id]', params: { id: result.product?.id || 'latest' } });
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Handle rate limiting specially
      if (err.error === 'rate_limited') {
        Toast.show({
          type: 'error',
          text1: 'Hold on—too many requests',
          text2: 'Please wait a minute before trying again.'
        });
        setError({ message: err.message || 'Rate limit exceeded. Please wait a minute.' });
      } else {
        setError({ message: err.message || 'An unexpected error occurred.' });
      }
      setCurrentStep('');
    } finally {
      setLoading(false);
    }
  };

  const copyErrorDetails = async () => {
    if (error) {
      const errorJson = JSON.stringify(error, null, 2);
      await Clipboard.setStringAsync(errorJson);
      Toast.show({ type: 'success', text1: 'Copied', text2: 'Error details copied to clipboard' });
    }
  };

  const retryAnalysis = () => {
    setError(null);
    handleSubmit();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} >
      <Typography variant="h1">Paste URL</Typography>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="https://magnumsupps.com/en-us/products/quattro"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          editable={!loading}
        />
        <Button title="Paste" onPress={handlePaste} disabled={loading} />
      </View>
      
      {loading && (
        <View style={[styles.analyzingContainer, { backgroundColor: colors.overlay || 'rgba(0,0,0,0.02)' }]}>
          <Typography variant="h2" style={[styles.analyzingTitle, { color: colors.textPrimary }]}>
            ✨ Analyzing Supplement...
          </Typography>
          <Typography variant="body" style={[styles.currentStep, { color: colors.textSecondary }]}>
            {currentStep}
          </Typography>
          
          <View style={styles.stepsContainer}>
            {['🔥 Firecrawl extraction', '🕷️ Scrapfly fallback', '🤖 ScraperAPI fallback', '👁️ OCR analysis'].map((step, index) => (
              <View key={index} style={[styles.stepItem, { 
                borderColor: colors.mint || '#B6F6C8',
                backgroundColor: colors.background || '#FFFDF9'
              }]}>
                <Typography variant="bodySmall" style={{ color: colors.textSecondary }}>
                  {step}
                </Typography>
              </View>
            ))}
          </View>
        </View>
      )}
      
      {error && (
        <ScrollView style={styles.errorContainer}>
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Typography variant="h3" style={[styles.errorTitle, { color: colors.semantic?.error || '#EF4444' }]}>
              🔍 Analysis Incomplete {error.status ? `(${error.status})` : ''}
            </Typography>
            
            <Typography variant="body" style={[styles.errorMessage, { color: colors.textSecondary }]}>
              {error.message}
            </Typography>
            
            {error.chain && (
              <View style={styles.chainContainer}>
                <Typography variant="bodySmall" weight="semibold" style={[styles.chainTitle, { color: colors.textPrimary }]}>
                  Provider Chain:
                </Typography>
                {error.chain.map((step, index) => (
                  <View key={index} style={[styles.chainStep, { backgroundColor: colors.background }]}>
                    <View style={styles.chainStepHeader}>
                      <Typography variant="bodySmall" weight="semibold" style={{ color: colors.textPrimary }}>
                        {step.provider}
                      </Typography>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(step.status) }]}>
                        <Typography variant="bodySmall" style={{ color: '#FFF', fontSize: 10 }}>
                          {step.status}
                        </Typography>
                      </View>
                      <Typography variant="bodySmall" style={{ color: colors.textSecondary }}>
                        {step.ms}ms
                      </Typography>
                    </View>
                    {step.hint && (
                      <Typography variant="bodySmall" style={[styles.chainHint, { color: colors.textSecondary }]}>
                        {step.hint}
                      </Typography>
                    )}
                  </View>
                ))}
              </View>
            )}
            
            <View style={styles.errorActions}>
              <Button title="Copy JSON" onPress={copyErrorDetails} variant="outline" />
              <Button title="Try Again" onPress={retryAnalysis} />
            </View>
          </Card>
        </ScrollView>
      )}
      
      {!loading && !error && (
        <Button title="Analyze URL" onPress={handleSubmit} fullWidth />
      )}
      
      <Toast />
    </View>
  );

  function getStatusColor(status: string): string {
    switch (status) {
      case 'ok': return '#10B981';
      case 'empty': return '#F59E0B';
      case 'error': return '#EF4444';
      default: return '#6B7280';
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
  },
  analyzingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  analyzingTitle: {
    marginBottom: 8,
  },
  currentStep: {
    marginBottom: 24,
    textAlign: 'center',
  },
  stepsContainer: {
    width: '100%',
  },
  stepItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  errorContainer: {
    flex: 1,
  },
  errorCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorTitle: {
    marginBottom: 8,
  },
  errorMessage: {
    marginBottom: 16,
    lineHeight: 20,
  },
  chainContainer: {
    marginBottom: 16,
  },
  chainTitle: {
    marginBottom: 8,
  },
  chainStep: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  chainStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chainHint: {
    marginTop: 4,
    fontSize: 12,
    fontStyle: 'italic',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 12,
  },
});
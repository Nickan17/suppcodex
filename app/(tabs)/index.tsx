import 'react-native-get-random-values'; // polyfill for crypto.randomUUID on older Expo
import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import ResultPanel from '@/components/ResultPanel';
import { chainExtractToScore } from '@/utils/chainExtractToScore';
import { useProductContext } from '@/contexts/ProductContext';

export default function HomeScreen() {
  console.log('HomeScreen rendering...');
  const { setProduct } = useProductContext();
  const [testUrl] = useState('https://magnumsupps.com/en-us/products/quattro');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const handleAnalyzeTestUrl = async () => {
    setIsLoading(true);
    try {
      const product = await chainExtractToScore(testUrl);
      
      // Store product in context
      setProduct(product);
      
      // Navigate to score screen
      router.push(`/score/${product.productId}`);
    } catch (err: any) {
      console.error('Analysis failed:', err);
      setResult({ ok: false, message: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleScore = async () => {
    if (!result?.ok) return { ok: false, status: 422, message: 'No valid data to score' };
    
    try {
      const { invokeEdgeFunction } = await import('@/utils/api');
      const scoreResponse = await invokeEdgeFunction('score-supplement', { 
        data: { parsed: result.data } 
      });
      return scoreResponse;
    } catch (error) {
      return { ok: false, status: 500, message: error.message };
    }
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFDF9', padding: 20, paddingTop: 60 }}>
      <Typography variant="h2" weight="bold" style={{ textAlign: 'center', marginBottom: 10, color: '#183A2B' }}>🌿 SuppCodex</Typography>
      <Typography variant="body" style={{ textAlign: 'center', marginBottom: 30, color: '#183A2B', opacity: 0.7 }}>Discover the wellness potential of your supplements</Typography>
      
      <View style={{ marginBottom: 30 }}>
        <Button 
          title="Paste a URL"
          onPress={() => router.push('/paste')}
          variant="primary"
          style={{ marginBottom: 16 }}
        />
        <Button 
          title="Scan Barcode"
          onPress={() => router.push('/scan')}
          variant="secondary"
        />
      </View>

      <View style={{ marginBottom: 20 }}>
        <Typography variant="body" weight="semibold" style={{ marginBottom: 10, color: '#999' }}>Development Test:</Typography>
        <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}>
          <Typography variant="bodySmall" style={{ color: '#666' }}>{testUrl}</Typography>
        </View>
      </View>
      
      <Button 
        title={isLoading ? "Analyzing..." : "Analyze Test URL"}
        onPress={handleAnalyzeTestUrl}
        disabled={isLoading}
        variant="outline"
        style={{ marginBottom: 20 }}
      />
      
      {result && (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <ResultPanel
            url={testUrl}
            ok={result.ok}
            data={result.data}
            raw={result}
            meta={{
              status: result.data?._meta?.status || (result.ok ? 'success' : 'unknown'),
              remediation: result.data?._meta?.remediation,
              source: result.data?._meta?.source,
              timings: {
                ...(result.data?._meta?.firecrawlExtract && { 
                  firecrawl: result.data._meta.firecrawlExtract.ms 
                }),
                ...(result.data?._meta?.scrapfly && { 
                  scrapfly: result.data._meta.scrapfly.ms 
                }),
                ...(result.data?._meta?.scraperapi && { 
                  scraperapi: result.data._meta.scraperapi.ms 
                })
              },
              parserSteps: result.data?._meta?.parserSteps || []
            }}
            onScore={handleScore}
          />
        </ScrollView>
      )}

    </View>
  );
}


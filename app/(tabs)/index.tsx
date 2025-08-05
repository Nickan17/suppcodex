import 'react-native-get-random-values'; // polyfill for crypto.randomUUID on older Expo
import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import Colors from '@/constants/Colors';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SearchBar from '@/components/SearchBar';
import ScanPlaceholder from '@/components/ScanPlaceholder';
import ResultPanel from '@/components/ResultPanel';
import { Camera, Link2, FileText, ChevronRight, ScanLine, History } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { BarCodeScanner } from 'expo-barcode-scanner';
import Constants from 'expo-constants';

export default function HomeScreen() {
  console.log('HomeScreen rendering...');
  const [testUrl, setTestUrl] = useState('https://magnumsupps.com/en-us/products/quattro');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const testFirecrawl = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      const { invokeEdgeFunction } = await import('@/utils/api');
      console.log('Testing URL:', testUrl);
      const response = await invokeEdgeFunction('firecrawl-extract', { url: testUrl });
      console.log('Response:', response);
      setResult(response);
    } catch (error) {
      console.error('Test error:', error);
      setResult({ ok: false, message: error.message });
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
    <View style={{ flex: 1, backgroundColor: '#ffffff', padding: 20, paddingTop: 60 }}>
      <Typography variant="h2" weight="bold" style={{ textAlign: 'center', marginBottom: 10 }}>SuppScan</Typography>
      <Typography variant="body" style={{ textAlign: 'center', marginBottom: 30, color: '#666' }}>Test the firecrawl-extract function</Typography>
      
      <View style={{ marginBottom: 20 }}>
        <Typography variant="body" weight="semibold" style={{ marginBottom: 10 }}>Test URL:</Typography>
        <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 }}>
          <Typography variant="bodySmall" style={{ color: '#666' }}>{testUrl}</Typography>
        </View>
      </View>
      
      <Button 
        title={isLoading ? "Testing..." : "Test Extraction"}
        onPress={testFirecrawl}
        disabled={isLoading}
        variant="primary"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16 + Constants.statusBarHeight,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    marginBottom: 8,
  },
  scanCard: {
    marginBottom: 16,
  },
  scanCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  optionButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionText: {
    marginLeft: 8,
  },
  recentContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    marginLeft: 8,
  },
  viewAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scannerCard: {
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  scanner: {
    height: 300,
    width: '100%',
  },
  cancelButton: {
    margin: 16,
  },
});
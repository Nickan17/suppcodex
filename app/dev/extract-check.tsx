import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Clipboard } from 'react-native';
import { chainExtractToScore } from '@/utils/chainExtractToScore';
import { ProductRecord } from '../../src/types/product';

const ExtractCheckScreen = () => {
  const [testUrl, setTestUrl] = useState('https://magnumsupps.com/en-us/products/quattro');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyzeTestUrl = async () => {
    setLoading(true);
    setResult(null);
    try {
      const result = await chainExtractToScore(testUrl);
      if (result.success) {
        setResult(result.parsed);
      } else {
        setResult(result.error);
      }
    } catch (e) {
      setResult({ error: { message: e.message } });
    } finally {
      setLoading(false);
    }
  };

  if (process.env.NODE_ENV !== 'development' && process.env.EXPO_PUBLIC_SHOW_DEV !== '1') {
    return (
      <View style={styles.container}>
        <Text>Dev tools are only available in development.</Text>
      </View>
    );
  }

  const isError = result && (result.error || result.message);
  const chain = result?._meta?.chain ?? [];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Extraction Check</Text>
      <TextInput
        style={styles.input}
        value={testUrl}
        onChangeText={setTestUrl}
        placeholder="Enter URL"
      />
      <View style={styles.buttonContainer}>
        <Button title="Analyse Test URL" onPress={handleAnalyzeTestUrl} disabled={loading} />
      </View>

      {loading && <Text>Loading...</Text>}

      {result && (
        <View>
          <View style={[styles.card, isError && styles.warningCard]}>
            <Text style={styles.cardTitle}>{isError ? 'Extraction Failed' : 'Parsed Summary'}</Text>
            {isError ? (
              <Text>{result.message || 'No content found'}</Text>
            ) : (
              <>
                <Text>Title: {result.title}</Text>
                <Text>Ingredients: {result.ingredients_raw?.length || 0}</Text>
                <Text>Has Facts: {result.supplement_facts ? 'Yes' : 'No'}</Text>
              </>
            )}
          </View>

          {chain.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Provider Chain</Text>
              {chain.map((step: any, i: number) => (
                <Text key={i}>
                  {step.provider}: {step.status} ({step.ms}ms) - {step.code} {step.hint}
                </Text>
              ))}
            </View>
          )}
          <Button
            title="Copy JSON"
            onPress={() => Clipboard.setString(JSON.stringify(result, null, 2))}
          />
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 8,
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});

export default ExtractCheckScreen;
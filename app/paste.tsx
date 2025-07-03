import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';

export default function PasteScreen() {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    setUrl(text);
  };

  const handleSubmit = async () => {
    if (!url) {
      return Alert.alert('No URL', 'Please paste a URL to continue.');
    }

    setLoading(true);

    try {
      // 1. Call firecrawl-extract
      const { data: extractData, error: extractError } = await supabase.functions.invoke('firecrawl-extract', {
        body: { url },
      });

      if (extractError) {
        throw extractError;
      }

      // 2. Call score-supplement
      const { data: scoreData, error: scoreError } = await supabase.functions.invoke('score-supplement', {
        body: { markdown: extractData.markdown },
      });

      if (scoreError) {
        throw scoreError;
      }

      // 3. Navigate to product page
      router.push(`/product/${scoreData.id}`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} >
      <Typography variant="h1">Paste URL</Typography>
      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder="https://example.com/product"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Button title="Paste" onPress={handlePaste} />
      </View>
      <Button title="Submit" onPress={handleSubmit} isLoading={loading} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
});
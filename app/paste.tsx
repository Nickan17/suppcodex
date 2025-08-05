import React, { useState } from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import Colors from '@/constants/Colors';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import Toast from 'react-native-toast-message';
import SkeletonCard from '@/components/SkeletonCard';
import { chainExtractToScore } from '@/utils/api';

import * as Haptics from 'expo-haptics';

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
      Toast.show({ type: 'error', text1: 'No URL', text2: 'Please paste a URL to continue.' });
      return;
    }
    setLoading(true);
    try {
      const result = await chainExtractToScore(url);
      if (!result.ok) {
        Toast.show({ type: 'error', text1: 'Processing Failed', text2: result.message });
        return;
      }
      
      // Haptic feedback on success
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Log Edge Function response
      console.log('Edge result:', JSON.stringify(result.data, null, 2));
      // Navigate to product page with score data
      router.push(`/product/${result.data.id}?score=${encodeURIComponent(JSON.stringify(result.data.score))}`);
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: 'error', text1: 'Oops', text2: err.message });
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
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <SkeletonCard height={200} style={{ marginBottom: 16 }} />
          <SkeletonCard height={60} />
        </View>
      ) : (
        <Button title="Submit" onPress={handleSubmit} isLoading={loading} fullWidth />
      )}
      <Toast />
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
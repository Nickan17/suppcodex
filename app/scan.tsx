import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Typography from '@/components/ui/Typography';
import Toast from 'react-native-toast-message';
import { chainExtractToScore } from '@/utils/api';

import * as Haptics from 'expo-haptics';

export default function ScanScreen() {
  const [loading, setLoading] = useState(false);

  const handleSimulateScan = async () => {
    setLoading(true);
    try {
      // Simulate async scan/fetch
      await new Promise(res => setTimeout(res, 1800));
      
      // Call chained edge functions
      const result = await chainExtractToScore('https://example.com/product');
      
      if (!result.ok) {
        Toast.show({ type: 'error', text1: 'Scan Failed', text2: result.message });
        return;
      }
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Scan Success', text2: 'Navigating to product...' });
      // Log Edge Function result
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
    <View style={styles.container}>
      <Typography variant="h1">Scan Barcode</Typography>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <TouchableOpacity onPress={handleSimulateScan} style={styles.scanButton}>
          <Typography variant="body" weight="medium">Simulate Scan</Typography>
        </TouchableOpacity>
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
  },
  scanButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    backgroundColor: '#eee',
    borderRadius: 8,
    marginTop: 24,
  },
});
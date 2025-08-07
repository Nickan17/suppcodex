import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Typography from '@/components/ui/Typography';
import Toast from 'react-native-toast-message';
import { chainExtractToScore } from '@/utils/chainExtractToScore';
import { useProductContext } from '@/contexts/ProductContext';
import * as Haptics from 'expo-haptics';

export default function ScanScreen() {
  const { setProduct } = useProductContext();
  const [loading, setLoading] = useState(false);

  const handleSimulateScan = async () => {
    setLoading(true);
    try {
      // Simulate async scan/fetch
      await new Promise((res) => setTimeout(res, 1800));

      // Mock UPC scan - in real implementation, this would come from camera
      const mockUPC = '123456789012';

      // Call chained edge functions
      const { success, parsed, error } = await chainExtractToScore(mockUPC);

      if (!success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Toast.show({
          type: 'error',
          text1: 'Scan Failed',
          text2: error.message || 'Could not process UPC.',
        });
        return;
      }

      // Store product in context
      setProduct(parsed);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({ type: 'success', text1: 'Scan Success', text2: 'Processing supplement...' });

      // Navigate to score screen
      router.push({ pathname: '/score/[id]', params: { id: parsed.id } });
    } catch (err: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Toast.show({ type: 'error', text1: 'Scan Failed', text2: err.message });
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
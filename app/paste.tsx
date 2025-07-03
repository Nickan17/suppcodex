import React from 'react';
import { View, StyleSheet } from 'react-native';
import Typography from '@/components/ui/Typography';

export default function PasteScreen() {
  return (
    <View style={styles.container}>
      <Typography variant="h1">Paste URL</Typography>
      <Typography>Coming soon!</Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
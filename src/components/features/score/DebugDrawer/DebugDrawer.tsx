import React, { useMemo } from 'react';
import { Platform, Modal, View, Text, ScrollView, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  parsed?: any;
  raw?: any;
  logs?: any;
  meta?: any;
};

export default function DebugDrawer({ visible, onClose, parsed, raw, logs, meta }: Props) {
  // Dev-only visibility
  if (!__DEV__) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <Text style={styles.title}>Debug</Text>
        <ScrollView style={styles.content}>
          {/* Render tabs inline or simple sections */}
          <Text style={styles.section}>Parsed</Text>
          <Text selectable>{JSON.stringify(parsed ?? null, null, 2)}</Text>

          <Text style={styles.section}>Raw</Text>
          <Text selectable>{JSON.stringify(raw ?? null, null, 2)}</Text>

          <Text style={styles.section}>Logs</Text>
          <Text selectable>{JSON.stringify(logs ?? null, null, 2)}</Text>

          <Text style={styles.section}>Meta</Text>
          <Text selectable>{JSON.stringify(meta ?? null, null, 2)}</Text>
        </ScrollView>
        <Text style={styles.close} onPress={onClose}>Close</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', paddingTop: 64 },
  title: { fontSize: 18, fontWeight: '600', padding: 16 },
  content: { backgroundColor: '#fff', margin: 12, padding: 12, borderRadius: 12 },
  section: { marginTop: 12, fontWeight: '600' },
  close: { textAlign: 'center', padding: 16, color: '#007AFF', fontWeight: '600' },
});
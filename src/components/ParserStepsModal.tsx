import React from 'react';
import { View, Modal, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../design-system/theme';
import Colors from '../constants/Colors';
import Typography from './ui/Typography';
import { X } from 'lucide-react-native';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  visible: boolean;
  onClose: () => void;
  steps: string[];
}

const ParserStepsModal = ({ visible, onClose, steps }: Props) => {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <AnimatePresence>
      {visible && (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <View style={[styles.container, { backgroundColor: colors.background }]}>
              <View style={styles.header}>
                <Typography variant="h3" weight="semibold">Parser Steps</Typography>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <X size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.content}>
                {steps.map((step, index) => (
                  <View key={index} style={styles.stepContainer}>
                    <Typography variant="bodySmall" color={colors.textSecondary} style={styles.stepText}>
                      {step}
                    </Typography>
                  </View>
                ))}
              </ScrollView>
            </View>
          </motion.div>
        </Modal>
      )}
    </AnimatePresence>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E4E4E7' },
  closeButton: { padding: 4 },
  content: { flex: 1, padding: 16 },
  stepContainer: { marginBottom: 12, padding: 12, backgroundColor: '#F4F4F5', borderRadius: 8 },
  stepText: { fontFamily: 'JetBrainsMono-Regular' },
});

export default ParserStepsModal; 
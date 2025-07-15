import { useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Card from './ui/Card'; // Using local Card component
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

type Props = {
  score: number;
  pros: string[];
  cons: string[];
};

function gradeColor(grade: string) {
  return grade === 'A' ? '#16a34a' : grade === 'B' ? '#eab308' : '#ef4444';
}

export default function ScoreCard({ score, pros = [], cons = [] }: Props) {
  const cardRef = useRef<View>(null);
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : 'C';

  async function shareCard() {
    const uri = await captureRef(cardRef, { format: 'png', quality: 0.9 });
    await Sharing.shareAsync(uri);
  }

  return (
    <Pressable ref={cardRef} style={styles.card} onLongPress={shareCard}>
      <Card>
        <View style={styles.header}>
          <Text style={[styles.badge, { backgroundColor: gradeColor(grade) }]}>{grade}</Text>
          <Text style={styles.score}>{score}/100</Text>
        </View>

        <Text style={styles.sectionTitle}>Pros</Text>
        {pros.slice(0, 3).map((p) => (
          <Text key={p}>• {p}</Text>
        ))}

        <Text style={styles.sectionTitle}>Cons</Text>
        {cons.slice(0, 3).map((c) => (
          <Text key={c}>• {c}</Text>
        ))}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { 
    marginVertical: 8,
    padding: 16
  },
  header: { 
    flexDirection: 'row',
    alignItems: 'center', 
    marginBottom: 8 
  },
  badge: {
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontWeight: 'bold',
    marginRight: 12
  },
  score: { 
    fontSize: 24, 
    fontWeight: '700',
    color: '#333'
  },
  sectionTitle: { 
    fontWeight: '600', 
    marginTop: 16,
    marginBottom: 8,
    color: '#444'
  },
});
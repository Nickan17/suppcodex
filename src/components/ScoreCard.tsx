import { useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Card from './ui/Card'; // Using local Card component
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/design-system';
import { getGrade } from '@/utils/getGrade';

type Props = {
  score: number | null;
  pros?: string[];
  cons?: string[];
};

export default function ScoreCard({ score, pros = [], cons = [] }: Props) {
  const { colors } = useTheme();
  const cardRef = useRef<View>(null);
  const grade = getGrade(score);

  const gradeColor = (grade: string) => {
    return grade.startsWith('A') ? (colors.score?.good ?? colors.semantic.success) : 
           grade.startsWith('B') ? (colors.score?.medium ?? colors.semantic.warning) : 
           grade === '—' ? colors.textSecondary :
           (colors.score?.bad ?? colors.semantic.error);
  };

  async function shareCard() {
    const uri = await captureRef(cardRef, { format: 'png', quality: 0.9 });
    await Sharing.shareAsync(uri);
  }

  return (
    <Pressable ref={cardRef} style={styles.card} onLongPress={shareCard}>
      <Card>
        <View style={styles.header}>
          <Text style={[styles.badge, { backgroundColor: gradeColor(grade) }]}>{grade}</Text>
          <Text style={styles.score}>{typeof score === 'number' ? `${score}/100` : '— / 100'}</Text>
        </View>

        {pros.length > 0 && (
          <Text style={styles.sectionTitle}>Pros</Text>
        )}
        {pros.slice(0, 3).map((p, idx) => (
          <Text key={`${p}-${idx}`}>• {p}</Text>
        ))}

        {cons.length > 0 && (
          <Text style={styles.sectionTitle}>Cons</Text>
        )}
        {cons.slice(0, 3).map((c, idx) => (
          <Text key={`${c}-${idx}`}>• {c}</Text>
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
    fontWeight: '700'
  },
  sectionTitle: { 
    fontWeight: '600', 
    marginTop: 16,
    marginBottom: 8
  },
});
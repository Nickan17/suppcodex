import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../design-system/theme';
import Colors from '../constants/Colors';

interface Props {
  parsed: {
    title?: string;
    ingredients?: string;
    facts?: string;
  };
  showIcons?: boolean; // New prop for showing pass/fail icons
}

const RubricStatusBar = ({ parsed, showIcons = false }: Props) => {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const getLevel = (value: string | undefined, minLength: number): 'good' | 'medium' | 'bad' => {
    if (!value) return 'bad';
    return value.length >= minLength ? 'good' : 'medium';
  };
  const getColor = (level: 'good' | 'medium' | 'bad') => colors[`${level}Score`];
  const titleLevel = getLevel(parsed.title, 5);
  const ingrLevel = getLevel(parsed.ingredients, 100);
  const factsLevel = getLevel(parsed.facts, 300);
  const pills: { label: string; level: 'good' | 'medium' | 'bad' }[] = [
    { label: 'Title', level: titleLevel },
    { label: 'Ingr.', level: ingrLevel },
    { label: 'Facts', level: factsLevel },
  ];
  console.log(`Rubric for ${parsed.title || 'unknown'}: Title ${titleLevel}, Ingr. ${ingrLevel}, Facts ${factsLevel}`);
  const getIcon = (level: 'good' | 'medium' | 'bad') => {
    if (!showIcons) return null;
    return level === 'good' ? '🟢' : level === 'medium' ? '🟡' : '🔴';
  };

  return (
    <View style={styles.container}>
      {pills.map(({ label, level }) => (
        <View key={label} style={[styles.pill, { backgroundColor: getColor(level) }]}>
          {showIcons && <Text style={styles.icon}>{getIcon(level)}</Text>}
          <Text style={styles.text}>{label}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  text: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  icon: { fontSize: 8, marginRight: 2 },
});

export default RubricStatusBar; 
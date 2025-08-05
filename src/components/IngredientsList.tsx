import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import Colors from '../constants/Colors';

interface Props {
  ingredients: string[];
}

const IngredientsList = ({ ingredients }: Props) => {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const displayed = ingredients.slice(0, 5);
  const more = ingredients.length - 5;
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>Ingredients</Text>
      {displayed.map((item, index) => (
        <View key={index} style={styles.item}>
          <Text style={[styles.bullet, { color: colors.text }]}>•</Text>
          <Text style={[styles.text, { color: colors.text }]}>{item}</Text>
        </View>
      ))}
      {more > 0 && (
        <Text style={[styles.more, { color: colors.textSecondary }]}>... +{more} more</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  item: { flexDirection: 'row', marginBottom: 4 },
  bullet: { marginRight: 8 },
  text: { flex: 1 },
  more: { marginTop: 4, fontStyle: 'italic' },
});

export default IngredientsList; 
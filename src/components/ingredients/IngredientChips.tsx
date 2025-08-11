import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function IngredientChips({
  items,
  colors,
  initialCount = 14,
}: {
  items: string[];
  colors: any;
  initialCount?: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? items : items.slice(0, initialCount);

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {visible.map((ing, i) => (
          <View
            key={`${ing}-${i}`}
            accessibilityRole="text"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 16,
              maxWidth: '100%',
            }}
          >
            <Text style={{ fontSize: 12, color: colors.textPrimary, flexShrink: 1 }}>{ing}</Text>
          </View>
        ))}
      </View>

      {items.length > initialCount && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show fewer ingredients' : 'Show more ingredients'}
          onPress={() => setExpanded(s => !s)}
          style={{ alignSelf: 'center', marginTop: 10 }}
        >
          <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' }}>
            {expanded ? 'Show less' : `Show ${items.length - initialCount} more`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
} 
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/design-system/theme';

interface NavItem {
  icon: string;
  label: string;
  isSelected?: boolean;
  onPress: () => void;
}

interface BottomNavProps {
  items: NavItem[];
}

export const BottomNav: React.FC<BottomNavProps> = ({ items }) => {
  const { colors, fonts, spacing, radii } = useTheme();

  return (
    <View style={[styles.container, { 
      backgroundColor: colors.background,
      paddingBottom: spacing[6],
      paddingTop: spacing[4],
      paddingHorizontal: spacing[4],
    }]}>
      <View style={styles.navContent}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.navItem, {
              backgroundColor: item.isSelected ? colors.mint : 'transparent',
              borderRadius: radii.lg,
              padding: spacing[2],
            }]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={[styles.label, { 
              fontFamily: fonts.body.family,
              color: colors.textPrimary,
              opacity: item.isSelected ? 1 : 0.6,
            }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  navContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 60,
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
  },
});
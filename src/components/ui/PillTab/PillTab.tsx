import React from 'react';
import {
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native';
import { useTheme } from '@/design-system/theme';

interface PillTabProps {
  title: string;
  isSelected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export const PillTab: React.FC<PillTabProps> = ({
  title,
  isSelected = false,
  onPress,
  style,
}) => {
  const { colors, radii, spacing, fonts } = useTheme();
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (isSelected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isSelected, shimmerAnim]);

  const tabStyles: ViewStyle = {
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: isSelected ? colors.mint : 'transparent',
    paddingHorizontal: spacing[4],
    justifyContent: 'center',
    alignItems: 'center',
  };

  const textStyles: TextStyle = {
    fontFamily: fonts.body.family,
    fontSize: 16,
    color: isSelected ? colors.textPrimary : colors.textPrimary,
    opacity: isSelected ? 1 : 0.6,
  };

  return (
    <TouchableOpacity
      style={[tabStyles, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View style={{ opacity: isSelected ? shimmerAnim : 1 }}>
        <Text style={textStyles}>{title}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};
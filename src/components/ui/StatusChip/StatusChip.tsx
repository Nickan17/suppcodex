import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/design-system/theme';

interface StatusChipProps {
  label: string;
  status: 'success' | 'warning' | 'error';
  emoji?: string;
  style?: ViewStyle;
}

const StatusChip: React.FC<StatusChipProps> = ({
  label,
  status,
  emoji,
  style,
}) => {
  const { colors, radii, spacing, fonts } = useTheme();

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return colors.semantic.success;
      case 'warning':
        return colors.semantic.warning;
      case 'error':
        return colors.semantic.error;
      default:
        return colors.semantic.success;
    }
  };

  const chipStyles: ViewStyle = {
    backgroundColor: getStatusColor(),
    borderRadius: radii.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  };

  const textStyles: TextStyle = {
    fontFamily: fonts.body.family,
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: emoji ? spacing[1] : 0,
  };

  return (
    <View style={[chipStyles, style]}>
      {emoji && <Text style={{ fontSize: 16 }}>{emoji}</Text>}
      <Text style={textStyles}>{label}</Text>
    </View>
  );
};

export default StatusChip;
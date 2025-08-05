import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { useTheme } from '@/design-system/theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  style,
  textStyle,
  ...props
}) => {
  const { colors, radii, spacing, fonts } = useTheme();

  const getButtonStyles = (): ViewStyle => {
    let buttonStyle: ViewStyle = {
      borderRadius: radii.md,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 4,
    };

    if (size === 'sm') {
      buttonStyle = { ...buttonStyle, paddingVertical: spacing[2], paddingHorizontal: spacing[4] };
    } else if (size === 'md') {
      buttonStyle = { ...buttonStyle, paddingVertical: spacing[3], paddingHorizontal: spacing[5] };
    } else if (size === 'lg') {
      buttonStyle = { ...buttonStyle, paddingVertical: spacing[4], paddingHorizontal: spacing[6] };
    }

    if (variant === 'primary') {
      buttonStyle = {
        ...buttonStyle,
        backgroundColor: colors.peach,
        borderWidth: 0,
      };
    } else if (variant === 'outline') {
      buttonStyle = {
        ...buttonStyle,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.mint,
      };
    }

    if (fullWidth) {
      buttonStyle.width = '100%';
    }

    return buttonStyle;
  };

  const getTextStyles = (): TextStyle => {
    let textStyleObj: TextStyle = {
      fontFamily: fonts.heading.family,
      textAlign: 'center',
    };

    if (size === 'sm') {
      textStyleObj = { ...textStyleObj, fontSize: 14 };
    } else if (size === 'md') {
      textStyleObj = { ...textStyleObj, fontSize: 16 };
    } else if (size === 'lg') {
      textStyleObj = { ...textStyleObj, fontSize: 18 };
    }

    if (variant === 'primary') {
      textStyleObj = { ...textStyleObj, color: '#FFFFFF' };
    } else if (variant === 'outline') {
      textStyleObj = { ...textStyleObj, color: colors.textPrimary };
    }

    return textStyleObj;
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyles(),
        { opacity: props.disabled ? 0.6 : 1 },
        style,
      ]}
      activeOpacity={0.7}
      accessibilityRole="button"
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFFFFF' : colors.textPrimary}
          size="small"
        />
      ) : (
        <Text style={[getTextStyles(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
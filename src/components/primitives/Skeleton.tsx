import React from 'react';
import { Animated } from 'react-native';

export function Skeleton({ height = 14, radius = 8, style }: { height?: number; radius?: number; style?: any }) {
  const opacity = React.useRef(new Animated.Value(0.5)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        { height, borderRadius: radius, opacity, backgroundColor: '#ECEFF3' },
        style,
      ]}
    />
  );
} 
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type Props = {
  score: number | null;       // null => neutral ring
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  progressColor?: string;
  grade?: string;             // optional, for center label
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function ScoreRing({
  score,
  size = 200,
  strokeWidth = 12,
  trackColor = '#E5E7EB',
  progressColor = '#7CC7A3',
  grade = '—',
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Ensure all calculations are finite numbers
  const pct = Number.isFinite(score) ? score! : 0;
  const progress = clamp01(pct / 100);
  const dashOffsetNum = circumference * (1 - progress);

  // Defensive casting to avoid NaN in SVG attributes
  const dashArray = String(isFinite(circumference) ? circumference : 0);
  const dashOffset = String(isFinite(dashOffsetNum) ? dashOffsetNum : 0);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
          fill="none"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '700' }}>{grade}</Text>
        <Text style={{ opacity: 0.7 }}>{Number.isFinite(score) ? `${Math.round(score!)} / 100` : '— / 100'}</Text>
      </View>
    </View>
  );
}
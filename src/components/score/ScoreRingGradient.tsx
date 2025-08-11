import React from 'react';
import { View, Text } from 'react-native';
let SvgLib: any = null;
try {
  // dynamic require to avoid hard dependency
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SvgLib = require('react-native-svg');
} catch {}
import FallbackScoreRing from '../ui/ScoreRing/ScoreRing';

export default function ScoreRingGradient({ score, grade, size = 200 }: { score: number; grade: string; size?: number }) {
  if (!SvgLib) {
    return <FallbackScoreRing score={score} grade={grade} size={size} />;
  }

  const { Svg, Circle, Defs, LinearGradient, Stop } = SvgLib;

  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Number.isFinite(score) ? score : 0;
  const progress = Math.min(1, Math.max(0, pct / 100));
  const dashOffset = circumference * (1 - progress);

  // simple gradient from primary to token variant
  const gradId = 'scoreGrad';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#7CC7A3" stopOpacity="1" />
            <Stop offset="100%" stopColor="#4BAF8A" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5E7EB" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${dashOffset}`}
          fill="none"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '700' }}>{grade}</Text>
        <Text style={{ opacity: 0.7 }}>{Number.isFinite(score) ? `${Math.round(score)} / 100` : '— / 100'}</Text>
      </View>
    </View>
  );
} 
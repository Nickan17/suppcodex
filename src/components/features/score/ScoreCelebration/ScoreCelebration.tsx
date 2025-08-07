import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
// Lazy import haptics; Expo will tree-shake no-ops on web
import * as Haptics from 'expo-haptics';

type Props = { fire: boolean };

export default function ScoreCelebration({ fire }: Props) {
  const [Confetti, setConfetti] = useState<React.ComponentType<any> | null>(null);

  // Lazy-load native-only confetti on non-web
  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('react-native-confetti-cannon')
        .then(mod => setConfetti(() => mod.default))
        .catch(() => setConfetti(null));
    }
  }, []);

  // Haptics only on native
  useEffect(() => {
    if (fire && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [fire]);

  if (!fire) return null;
  // On web, Confetti will be null → render nothing
  return Confetti ? <Confetti count={120} origin={{ x: -10, y: 0 }} fadeOut /> : null;
}
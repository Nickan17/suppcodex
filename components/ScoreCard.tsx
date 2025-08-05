import React from 'react';
import { View, Platform } from 'react-native';
import { useTheme } from '@/design-system/theme/useTheme';
import Colors from '@/constants/Colors';
import Typography from '@/components/ui/Typography';

type ScoreCardProps = {
  score?: number;                      // 0–100
  justification?: string;              // short paragraph (optional)
  highlights?: string[];               // ✓ list (optional)
  concerns?: string[];                 // ⚠︎ list (optional)
  meta?: { model?: string; ts?: number };
};

export default function ScoreCard({ score, justification, highlights = [], concerns = [], meta }: ScoreCardProps) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;

  // Score color mapping
  const getScoreColor = (score: number) => {
    if (score >= 90) return '#10b981'; // emerald
    if (score >= 75) return '#84cc16'; // lime
    if (score >= 60) return '#eab308'; // yellow
    if (score >= 40) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const getGrade = (score: number) => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const formatRelativeTime = (ts?: number) => {
    if (!ts) return '';
    const now = Date.now();
    const diff = now - ts;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const scoreColor = score !== undefined ? getScoreColor(score) : colors.textSecondary;

  return (
    <View style={{
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    }}>
      {/* Score Badge */}
      <View style={{ 
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16 
      }}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: scoreColor + '20',
          borderWidth: 3,
          borderColor: scoreColor,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 16,
        }}>
          <Typography variant="h1" weight="bold" style={{ color: scoreColor, fontSize: 24 }}>
            {score !== undefined ? score : '?'}
          </Typography>
        </View>
        
        <View style={{ flex: 1 }}>
          <Typography variant="h3" weight="semibold" style={{ marginBottom: 4 }}>
            AI Score {score !== undefined ? `${score} / 100` : 'Unavailable'}
          </Typography>
          {score !== undefined && (
            <View style={{
              backgroundColor: scoreColor + '20',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 12,
              alignSelf: 'flex-start',
            }}>
              <Typography variant="bodySmall" style={{ color: scoreColor }}>
                Grade {getGrade(score)}
              </Typography>
            </View>
          )}
        </View>
      </View>

      {/* Justification */}
      {justification && (
        <View style={{ marginBottom: 16 }}>
          <Typography variant="body" style={{ color: colors.text, lineHeight: 20 }}>
            {justification}
          </Typography>
        </View>
      )}

      {/* Highlights & Concerns */}
      {(highlights.length > 0 || concerns.length > 0) && (
        <View style={{ marginBottom: 16 }}>
          {highlights.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Typography variant="body" weight="semibold" style={{ marginBottom: 8, color: '#10b981' }}>
                ✓ Highlights
              </Typography>
              {highlights.map((item, index) => (
                <View key={index} style={{ flexDirection: 'row', marginBottom: 4 }}>
                  <Typography variant="bodySmall" style={{ color: '#10b981', marginRight: 8 }}>
                    ✓
                  </Typography>
                  <Typography variant="bodySmall" style={{ color: colors.text, flex: 1 }}>
                    {item}
                  </Typography>
                </View>
              ))}
            </View>
          )}
          
          {concerns.length > 0 && (
            <View>
              <Typography variant="body" weight="semibold" style={{ marginBottom: 8, color: '#f59e0b' }}>
                ⚠︎ Concerns
              </Typography>
              {concerns.map((item, index) => (
                <View key={index} style={{ flexDirection: 'row', marginBottom: 4 }}>
                  <Typography variant="bodySmall" style={{ color: '#f59e0b', marginRight: 8 }}>
                    ⚠︎
                  </Typography>
                  <Typography variant="bodySmall" style={{ color: colors.text, flex: 1 }}>
                    {item}
                  </Typography>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Meta Footnote */}
      {meta && (meta.model || meta.ts) && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
          <Typography variant="bodySmall" style={{ color: colors.textSecondary, fontSize: 10 }}>
            {meta.model && `Model: ${meta.model}`}
            {meta.model && meta.ts && ' • '}
            {meta.ts && formatRelativeTime(meta.ts)}
          </Typography>
        </View>
      )}
    </View>
  );
}

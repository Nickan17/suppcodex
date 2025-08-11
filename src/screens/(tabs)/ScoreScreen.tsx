import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useTheme } from '@/design-system';
import ScoreHeader from '@/components/features/score/ScoreHeader/ScoreHeader';
import StatChip from '@/components/score/StatChip';
import { chainExtractToScore } from '@/utils/chainExtractToScore';

type NormalizedScore = {
  purity?: number | null;
  effectiveness?: number | null;
  safety?: number | null;
  value?: number | null;
};

type ScoreResult = {
  title: string;
  overallScore: number | null;
  overallGrade?: string | null;
  normalizedScore?: NormalizedScore | null;
  strengths?: string[];
  concerns?: string[];
  ingredients?: string[];
  ingredients_raw?: string | null;
  serving_size?: string | null;
  meta?: { extract?: any; score?: any };
};

function toIngredientChips(result: ScoreResult): string[] {
  if (Array.isArray(result.ingredients) && result.ingredients.length) {
    return result.ingredients.map(s => s.trim()).filter(Boolean);
  }
  const raw = result.ingredients_raw || '';
  if (!raw) return [];
  return raw
    .replace(/^ingredients?\s*:/i, '')
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

export default function ScoreScreen() {
  const { colors } = useTheme();
  const [url, setUrl] = useState<string>(''); // ensure your navigation/params set this
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);

  const fetchScore = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const r = await chainExtractToScore(url, { force });
      // AUDIT: log UI consumption
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.debug('[ui][score]', { overall: r?.overallScore, grade: r?.overallGrade, subs: r?.normalizedScore });
      }
      setResult(r as ScoreResult);
    } catch (e: any) {
      console.error('[ScoreScreen] chainExtractToScore error', e);
      Alert.alert('Error', e?.message || 'Failed to score product.');
    } finally {
      setLoading(false);
    }
  }, [url]);

  const chips = useMemo(() => (result ? toIngredientChips(result) : []), [result]);
  const ns = result?.normalizedScore;

  const telemetry = useMemo(() => {
    const meta = result?.meta?.extract?._meta ?? {};
    const titleSource = meta.titleSource ?? meta.parser?.steps?.[0] ?? '—';
    const tokens = meta.factsTokens ?? 0;
    const serving = result?.serving_size ?? '—';
    const quality = tokens >= 2 ? 'Good' : 'Partial';
    return { titleSource, tokens, serving, quality, raw: meta };
  }, [result]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 64 }}>
      <ScoreHeader
        title={result?.title || 'Product'}
        score={result?.overallScore ?? null}
        grade={result?.overallGrade ?? undefined}
        subtitle="Great pick! 🌱"
      />

      {/* Dev-only tiny panel */}
      {__DEV__ && result && (
        <View style={{ alignSelf: 'stretch', margin: 12, padding: 10, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.03)' }}>
          <Text style={{ fontSize: 12 }}>dbg overall: {String(result.overallScore)}  grade: {String(result.overallGrade)}</Text>
          <Text style={{ fontSize: 12 }}>dbg subs: {JSON.stringify(result.normalizedScore)}</Text>
          <Text style={{ fontSize: 12 }}>dbg raw keys: {JSON.stringify(Object.keys(result?.meta?.score || {}))}</Text>
        </View>
      )}

      {result && (
        <Pressable
          onLongPress={() => console.log('[meta]', telemetry.raw)}
          style={{
            alignSelf: 'center',
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: colors.surface,
            marginBottom: 16
          }}
        >
          <Text style={{ color: colors.textSecondary }}>
            Source: {telemetry.titleSource}   •   Tokens: {telemetry.tokens}   •   Serving: {telemetry.serving}   —   {telemetry.quality}
          </Text>
        </Pressable>
      )}

      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <StatChip icon={<Text>🍃</Text>} label="Purity"         value={ns?.purity ?? null}         tone="green"  colors={colors} />
        <StatChip icon={<Text>🔮</Text>} label="Effectiveness" value={ns?.effectiveness ?? null}  tone="purple" colors={colors} />
        <StatChip icon={<Text>🛡️</Text>} label="Safety"        value={ns?.safety ?? null}         tone="red"    colors={colors} />
        <StatChip icon={<Text>💰</Text>} label="Value"         value={ns?.value ?? null}          tone="gold"   colors={colors} />
      </View>

      {chips.length > 0 ? (
        <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
          <Text style={{ fontWeight: '700', marginBottom: 8, color: colors.textPrimary }}>Ingredients</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {chips.map((c) => (
              <View key={c} style={{ backgroundColor: colors.surface, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 }}>
                <Text style={{ color: colors.textPrimary }}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : result ? (
        <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
          <Text style={{ color: colors.textSecondary }}>Ingredients not provided.</Text>
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 16, marginTop: 24, gap: 12 }}>
        <Pressable
          disabled={loading || !url}
          onPress={() => fetchScore(true)}
          style={{
            opacity: loading || !url ? 0.6 : 1,
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center'
          }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Rescore (force)</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}
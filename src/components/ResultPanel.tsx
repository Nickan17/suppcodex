import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '@/design-system/theme/useTheme';
import Colors from '@/constants/Colors';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import ScoreCard from '@/components/ScoreCard';
import { Copy, Share, Sparkles } from 'lucide-react-native';

type ResultPanelProps = {
  url: string;
  ok: boolean;
  data?: any;   // Parsed (preferred)
  raw?: any;    // Full payload (optional)
  meta?: {
    status?: string;           // "success" | "parser_fail" | "blocked_by_site" | "dead_url" | "provider_error" | ...
    remediation?: string;      // e.g., "none", "site_specific_parser"
    source?: "firecrawl" | "scrapfly" | "scraperapi";
    timings?: { [k: string]: number }; // ms for providers: { firecrawl: 4593, scrapfly: 16859 }
    parserSteps?: string[];
  };
  logs?: string[];  // optional lines
  onScore?: () => Promise<{ ok: boolean; status: number; data?: any; message?: string }>;
};

export default function ResultPanel({ url, ok, data, raw, meta, logs = [], onScore }: ResultPanelProps) {
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const [activeTab, setActiveTab] = useState<'score' | 'parsed' | 'raw' | 'meta' | 'logs'>('score');
  const [isScoring, setIsScoring] = useState(false);
  const [scoreRes, setScoreRes] = useState<{ ok: boolean; status: number; data?: any; message?: string } | null>(null);
  const didScoreRef = useRef(false);
  
  // Reset guard when URL changes
  useEffect(() => {
    didScoreRef.current = false;
    setScoreRes(null);
  }, [url]);
  
  // Auto-score on successful extract
  useEffect(() => {
    const unscorables = ['parser_fail', 'blocked_by_site', 'dead_url', 'provider_error'];
    const bad = meta?.status && unscorables.includes(meta.status);
    const parsed = data;
    
    if (!bad && ok === true && parsed && !didScoreRef.current && onScore) {
      didScoreRef.current = true;
      setIsScoring(true);
      
      onScore()
        .then(r => setScoreRes(r))
        .catch(err => {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.error('Score error:', err);
          }
          Alert.alert('Scoring failed', err?.message || 'Unable to score supplement');
        })
        .finally(() => setIsScoring(false));
    }
  }, [ok, data, meta?.status, url, onScore]);

  // Status chip logic (explicit rules)
  const getStatusInfo = () => {
    if (ok === true) return { color: '#10b981', emoji: '🟢', text: 'Success' };
    
    const errorStatuses = ['parser_fail', 'blocked_by_site', 'dead_url', 'provider_error'];
    if (ok === false && errorStatuses.includes(meta?.status)) {
      return { color: '#ef4444', emoji: '🔴', text: 'Error' };
    }
    
    // Warning for other cases (ok false but status not in error list, or ok true with minor remediation)
    return { color: '#f59e0b', emoji: '🟡', text: 'Warning' };
  };
  
  // Format timings for meta strip
  const formatTimings = (timings: { [k: string]: number } = {}) => {
    return Object.entries(timings)
      .map(([key, ms]) => `${key} ${(ms / 1000).toFixed(1)}s`)
      .join(' • ');
  };

  const statusInfo = getStatusInfo();

  const copyToClipboard = async (content: any) => {
    await Clipboard.setStringAsync(JSON.stringify(content, null, 2));
  };

  const handleScore = async () => {
    if (!onScore) return;
    
    setIsScoring(true);
    try {
      const result = await onScore();
      if (result.ok) {
        router.push({
          pathname: '/product/[id]' as any,
          params: {
            id: result.data?.id ?? 'temp',
            score: JSON.stringify(result.data?.score ?? {}),
          }
        });
      }
    } catch (error) {
      console.error('Scoring error:', error);
    } finally {
      setIsScoring(false);
    }
  };

  const renderScoreSkeleton = () => (
    <View style={{ padding: 12 }}>
      {[1, 2, 3, 4].map(i => (
        <View
          key={i}
          style={{
            height: 12,
            backgroundColor: colors.textSecondary + '30',
            borderRadius: 6,
            marginBottom: 8,
            width: `${90 - i * 10}%`,
          }}
        />
      ))}
    </View>
  );
  
  const renderContent = () => {
    if (activeTab === 'score') {
      const unscorables = ['parser_fail', 'blocked_by_site', 'dead_url', 'provider_error'];
      const isUnscorable = meta?.status && unscorables.includes(meta.status);
      
      if (isScoring) {
        return renderScoreSkeleton();
      }
      
      if (scoreRes?.ok) {
        return (
          <ScrollView 
            style={{ maxHeight: Platform.OS === 'web' ? 400 : 420 }}
            contentContainerStyle={{ padding: 12 }}
            showsVerticalScrollIndicator={true}
          >
            <ScoreCard
              score={scoreRes.data?.score}
              justification={scoreRes.data?.justification}
              highlights={scoreRes.data?.highlights}
              concerns={scoreRes.data?.concerns}
              meta={{
                model: scoreRes.data?.model,
                ts: scoreRes.data?.timestamp || Date.now()
              }}
            />
          </ScrollView>
        );
      }
      
      if (scoreRes && !scoreRes.ok) {
        return (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Typography variant="body" style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 8 }}>
              ❌ Scoring failed
            </Typography>
            <Typography variant="bodySmall" style={{ color: colors.textSecondary, textAlign: 'center' }}>
              {scoreRes.message || 'Unable to generate score'}
            </Typography>
          </View>
        );
      }
      
      if (isUnscorable || !ok || !data) {
        return (
          <View style={{ padding: 16, alignItems: 'center' }}>
            <Typography variant="body" style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: 8 }}>
              Cannot score until parsing succeeds
            </Typography>
            {meta?.remediation && (
              <View style={{
                backgroundColor: colors.textSecondary + '15',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                marginTop: 8,
              }}>
                <Typography variant="bodySmall" style={{ color: colors.textSecondary }}>
                  Remediation: {meta.remediation}
                </Typography>
              </View>
            )}
          </View>
        );
      }
      
      return (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Typography variant="body" style={{ color: colors.textSecondary, textAlign: 'center' }}>
            Preparing to score...
          </Typography>
        </View>
      );
    }
    
    // Handle other tabs
    let content;
    switch (activeTab) {
      case 'parsed':
        content = data;
        break;
      case 'raw':
        content = raw || data;
        break;
      case 'meta':
        content = meta;
        break;
      case 'logs':
        content = logs.length > 0 ? logs.join('\n') : 'No logs available';
        break;
      default:
        content = data;
    }

    const jsonString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

    return (
      <ScrollView 
        style={{ maxHeight: Platform.OS === 'web' ? 400 : 420 }} 
        contentContainerStyle={{ padding: 12 }}
        showsVerticalScrollIndicator={true}
      >
        <Typography 
          variant="bodySmall" 
          style={{ 
            fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier New',
            fontSize: 12,
            lineHeight: 18,
            color: colors.text
          }}
          selectable
        >
          {jsonString}
        </Typography>
      </ScrollView>
    );
  };

  return (
    <View style={{
      backgroundColor: colors.backgroundSecondary,
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{
          backgroundColor: statusInfo.color + '20',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          marginRight: 12,
        }}>
          <Typography variant="bodySmall" style={{ color: statusInfo.color }}>
            {statusInfo.emoji} {statusInfo.text}
          </Typography>
        </View>
        
        <Typography 
          variant="bodySmall" 
          style={{ flex: 1, color: colors.textSecondary }}
          numberOfLines={1}
        >
          {url}
        </Typography>
        
        <TouchableOpacity 
          onPress={() => copyToClipboard(url)}
          style={{ marginLeft: 8, padding: 4 }}
        >
          <Copy size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Meta Strip */}
      {meta && (
        <View style={{ 
          flexDirection: 'row', 
          flexWrap: 'wrap', 
          marginBottom: 12, 
          paddingHorizontal: 4 
        }}>
          {meta.source && (
            <View style={{
              backgroundColor: colors.primary + '15',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 8,
              marginRight: 6,
              marginBottom: 4,
            }}>
              <Typography variant="bodySmall" style={{ color: colors.primary, fontSize: 10 }}>
                Source: {meta.source}
              </Typography>
            </View>
          )}
          
          {meta.timings && Object.keys(meta.timings).length > 0 && (
            <View style={{
              backgroundColor: colors.textSecondary + '15',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 8,
              marginRight: 6,
              marginBottom: 4,
            }}>
              <Typography variant="bodySmall" style={{ color: colors.textSecondary, fontSize: 10 }}>
                Timings: {formatTimings(meta.timings)}
              </Typography>
            </View>
          )}
          
          {meta.status && (
            <View style={{
              backgroundColor: statusInfo.color + '15',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 8,
              marginRight: 6,
              marginBottom: 4,
            }}>
              <Typography variant="bodySmall" style={{ color: statusInfo.color, fontSize: 10 }}>
                Status: {meta.status}
              </Typography>
            </View>
          )}
          
          {meta.remediation && (
            <View style={{
              backgroundColor: colors.textSecondary + '15',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 8,
              marginBottom: 4,
            }}>
              <Typography variant="bodySmall" style={{ color: colors.textSecondary, fontSize: 10 }}>
                Remediation: {meta.remediation}
              </Typography>
            </View>
          )}
        </View>
      )}

      {/* Tabs */}
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        {[
          { key: 'score', label: 'Score' },
          { key: 'parsed', label: 'Parsed' },
          { key: 'raw', label: 'Raw' },
          { key: 'meta', label: 'Meta' },
          { key: 'logs', label: 'Logs' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key as any)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              marginRight: 8,
              borderRadius: 6,
              backgroundColor: activeTab === tab.key ? colors.primary + '20' : 'transparent',
            }}
          >
            <Typography 
              variant="bodySmall" 
              weight={activeTab === tab.key ? 'semibold' : 'regular'}
              style={{ 
                color: activeTab === tab.key ? colors.primary : colors.textSecondary 
              }}
            >
              {tab.label}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{
        backgroundColor: isDark ? colors.background : '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 16,
      }}>
        {renderContent()}
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity 
            onPress={() => copyToClipboard(activeTab === 'parsed' ? data : (activeTab === 'raw' ? raw || data : (activeTab === 'meta' ? meta : logs)))}
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              padding: 8,
              marginRight: 12,
            }}
          >
            <Copy size={16} color={colors.textSecondary} />
            <Typography variant="bodySmall" style={{ marginLeft: 4, color: colors.textSecondary }}>
              Copy JSON
            </Typography>
          </TouchableOpacity>
        </View>

        {ok && onScore && (
          <Button
            title={isScoring ? "Scoring..." : "Score with AI"}
            onPress={handleScore}
            disabled={isScoring}
            variant="primary"
            icon={<Sparkles size={16} color="#FFFFFF" />}
            style={{ minWidth: 120 }}
          />
        )}
      </View>
    </View>
  );
}

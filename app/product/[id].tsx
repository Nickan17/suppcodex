import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Platform, ActivityIndicator, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import Typography from '@/components/ui/Typography';
import Button from '@/components/ui/Button';
import ScoreCard from '@/components/ScoreCard';
import CategoryScoreCard from '@/components/CategoryScoreCard';
import { ArrowLeft, Bookmark, Share2, ExternalLink } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';

interface CategoryScore {
  name: string;
  score: number;
  insights: string[];
}

interface ProductData {
  upc: string;
  name: string;
  brand: string;
  imageUrl: string;
  overallScore: number;
  overallSummary: string;
  categories: CategoryScore[];
  productUrl?: string;
  highlights: string[]; // Add highlights to the interface
}

import { Text } from 'react-native';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  console.log('Product screen id param:', id);
  const { isDark } = useTheme();
  const colors = isDark ? Colors.dark : Colors.light;
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [data, setData] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const fetchProductData = async () => {
      if (!id) {
        setError('Product ID (UPC) is missing.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Step 1: Check Supabase for existing results
        const { data: existingProduct, error: supabaseError } = await supabase
          .from('products')
          .select('*')
          .or(`id.eq.${id},upc.eq.${id}`)
          .single();

        if (existingProduct) {
          setData({
            upc: existingProduct.upc,
            name: existingProduct.name,
            brand: existingProduct.brand || 'N/A',
            imageUrl: existingProduct.image || 'https://via.placeholder.com/150',
            overallScore: existingProduct.score,
            overallSummary: Array.isArray(existingProduct.highlights) ? existingProduct.highlights.join('\n') : 'N/A', // FIX IS HERE
            categories: [], // Supabase doesn't store categories in this schema
            productUrl: existingProduct.productUrl,
            highlights: existingProduct.highlights, // Ensure highlights are passed
          });
          setIsBookmarked(true); // Assume bookmarked if in Supabase
        }
      } catch (err: any) {
        console.error('Error fetching product data (main catch):', err);
        setErr(err.message || 'An unknown error occurred during product data fetching.');
      } finally {
        setLoading(false);
      }
    };

    fetchProductData();
  }, [id]);

  const toggleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    // TODO: Implement actual bookmarking logic with Supabase
  };

  if (loading) return <ActivityIndicator style={{ flex:1, justifyContent:'center' }} />;
  if (err) return <Text style={{ color:'red', padding:16 }}>Error: {err}</Text>;
  if (!data) return <Text style={{ padding:16 }}>No data found.</Text>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => {}}
            >
              <Share2 size={20} color={colors.text} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={toggleBookmark}
            >
              <Bookmark
                size={20}
                color={isBookmarked ? colors.primary : colors.text}
                fill={isBookmarked ? colors.primary : 'transparent'}
              />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.productHeader}>
          <Image source={{ uri: product.imageUrl }} style={styles.productImage} />
          
          <View style={styles.productInfo}>
            <Typography variant="bodySmall" color={colors.textSecondary} style={styles.brand}>
              {product.brand}
            </Typography>
            
            <Typography variant="h3" weight="semibold" style={styles.productName}>
              {product.name}
            </Typography>
          </View>
        </View>
        
        {/* Main Score Card */}
        <ScoreCard score={product.overallScore} pros={product.highlights?.slice(0,3) || []} cons={[]} />
        
        <Typography variant="h3" weight="semibold" style={styles.sectionTitle}>
          Detailed Analysis
        </Typography>
        
        {product.categories.map((category, index) => (
          <CategoryScoreCard
            key={index}
            category={category.name}
            score={category.score}
            insights={category.insights}
          />
        ))}
        
        <Button
          title="View on Manufacturer Website"
          variant="outline"
          fullWidth
          icon={<ExternalLink size={18} color={colors.primary} />}
          style={styles.websiteButton}
          onPress={() => product.productUrl && Linking.openURL(product.productUrl)}
          disabled={!product.productUrl}
        />
        
        <Button
          title="Compare With Similar Products"
          variant="secondary"
          fullWidth
          style={styles.compareButton}
          onPress={() => router.push({ pathname: '/new-comparison', params: { product: product.upc } })}
        />
      </ScrollView>
      
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  productInfo: {
    flex: 1,
  },
  brand: {
    marginBottom: 4,
  },
  productName: {
    lineHeight: 28,
  },
  sectionTitle: {
    marginBottom: 16,
    marginTop: 8,
  },
  websiteButton: {
    marginTop: 24,
    marginBottom: 12,
  },
  compareButton: {
    marginBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
});
import * as Share from 'expo-sharing';

interface ShareProductParams {
  name: string;
  brand: string;
  score: number;
  url?: string;
}

export const shareProduct = async ({ name, brand, score, url }: ShareProductParams) => {
  const scoreEmoji = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴';
  const message = `${scoreEmoji} ${brand} ${name}\n\nScore: ${score}/100\n\nCheck out this supplement on SuppCodex!`;
  
  const shareUrl = url || 'https://suppcodex.app';
  
  try {
    await Share.shareAsync(shareUrl, {
      mimeType: 'text/plain',
      dialogTitle: `Share ${name}`,
      UTI: 'public.plain-text'
    });
  } catch (error) {
    console.error('Share failed:', error);
  }
}; 
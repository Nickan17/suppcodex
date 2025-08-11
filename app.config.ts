import 'dotenv/config';

const config = {
  expo: {
    name: 'SuppCodex',
    slug: 'suppcodex',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'myapp',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    updates: { url: 'https://u.expo.dev/eed8a4b9-e354-47f0-9b92-b602a1e91e17' },
    runtimeVersion: { policy: 'appVersion' },
    ios: { supportsTablet: true },
    web: { bundler: 'metro', output: 'single', favicon: './assets/images/favicon.png' },
    plugins: ['expo-router', 'expo-font', 'expo-web-browser'],
    experiments: { typedRoutes: true },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      firecrawlExtractUrl: process.env.EXPO_PUBLIC_FIRECRAWL_EXTRACT_URL ?? '',
      scoreSupplementUrl: process.env.EXPO_PUBLIC_SCORE_SUPPLEMENT_URL ?? '',
      openrouterApiKey: process.env.EXPO_PUBLIC_OPENROUTER_API_KEY ?? '',
      eas: { projectId: 'eed8a4b9-e354-47f0-9b92-b602a1e91e17' },
    },
  },
};

export default config;

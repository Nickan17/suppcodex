import 'dotenv/config';

interface ExpoConfig {
  expo: {
    name: string;
    slug: string;
    version: string;
    orientation: string;
    icon: string;
    scheme: string;
    userInterfaceStyle: string;
    newArchEnabled: boolean;
    ios: {
      supportsTablet: boolean;
    };
    web: {
      bundler: string;
      output: string;
      favicon: string;
    };
    plugins: string[];
    experiments: {
      typedRoutes: boolean;
    };
    extra: {
      supabaseUrl: string | undefined;
      supabaseAnonKey: string | undefined;
      openrouterApiKey: string | undefined;
      firecrawlApiKey: string | undefined;
      eas: {
        projectId: string;
      };
    };
  };
}

const config: ExpoConfig = {
  expo: {
    name: 'bolt-expo-nativewind',
    slug: 'bolt-expo-nativewind',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'myapp',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    web: {
      bundler: 'metro',
      output: 'single',
      favicon: './assets/images/favicon.png',
    },
    plugins: ['expo-router', 'expo-font', 'expo-web-browser'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      // These will be available in Constants.expoConfig.extra
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      openrouterApiKey: process.env.EXPO_PUBLIC_OPENROUTER_API_KEY,
      firecrawlApiKey: process.env.EXPO_PUBLIC_FIRECRAWL_API_KEY,
      eas: {
        projectId: 'your-eas-project-id', // Replace with your actual EAS project ID if you have one
      },
    },
  },
};

export default config;

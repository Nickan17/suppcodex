import React, { createContext, ReactNode, useState } from 'react';
import { useColorScheme } from 'react-native';
import { colors, spacing, radii, fonts } from '../tokens';

type ThemeType = 'light' | 'dark' | 'system';

interface ThemeContextType {
  colors: typeof colors;
  spacing: typeof spacing;
  radii: typeof radii;
  fonts: typeof fonts;
  isDark: boolean;
  theme: ThemeType;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  console.log('MOUNT ThemeProvider v1');
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeType>('system');
  
  const isDark = theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark');
  
  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  const value = {
    colors,
    spacing,
    radii,
    fonts,
    isDark,
    theme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};


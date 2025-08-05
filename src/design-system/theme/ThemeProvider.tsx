import React, { createContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors, spacing, radii, fonts } from '../tokens';

interface ThemeContextType {
  colors: typeof colors;
  spacing: typeof spacing;
  radii: typeof radii;
  fonts: typeof fonts;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  console.log('MOUNT ThemeProvider v1');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const value = {
    colors,
    spacing,
    radii,
    fonts,
    isDark,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};


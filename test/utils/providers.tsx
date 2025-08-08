import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '@/design-system/theme';
import { NavigationContainer } from '@react-navigation/native';

export const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <NavigationContainer>
      <ThemeProvider>{ui}</ThemeProvider>
    </NavigationContainer>
  );
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import Home    from '../app/(tabs)/index';
import Search  from '../app/(tabs)/search';
import Compare from '../app/(tabs)/compare';

// ─── mocks ────────────────────────────────────────────────
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('expo-barcode-scanner', () => ({
  BarCodeScanner: () => 'BarCodeScanner',
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    colors: { primary: '#007AFF', background: '#FFF', text: '#000' },
  }),
}));
// ──────────────────────────────────────────────────────────

const pressAllButtons = (screen: React.ReactElement) => {
  const { getAllByRole } = render(screen);
  getAllByRole('button').forEach(btn => fireEvent.press(btn));
};

describe('Smoke-test: all primary buttons are pressable', () => {
  it('Home screen',    () => pressAllButtons(<Home />));
  it('Search screen',  () => pressAllButtons(<Search />));
  it('Compare screen', () => pressAllButtons(<Compare />));
});
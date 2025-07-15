import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PasteScreen from '../app/paste';

// Bind a single push mock for all calls
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

// Mock fetch to Firecrawl & scoring edge functions
(global as any).fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ id: '123' }) }),
);

describe('Paste URL flow', () => {
  afterEach(() => {
    mockPush.mockClear();
    (global.fetch as jest.Mock).mockClear();
  });

  it('submits URL and navigates to product page', async () => {
    const { getByPlaceholderText, getByText } = render(<PasteScreen />);

    fireEvent.changeText(
      getByPlaceholderText('https://example.com/product'),
      'https://example.com/product',
    );
    fireEvent.press(getByText(/submit/i));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
  });
});
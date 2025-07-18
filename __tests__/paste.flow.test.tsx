import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PasteScreen from '../app/paste';
import { router } from 'expo-router';

// Mock Supabase functions
jest.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn()
        .mockResolvedValueOnce({ data: { markdown: '## Test Product' }, error: null })
        .mockResolvedValueOnce({ data: { id: '123' }, error: null }),
    },
  },
}));

// Mock fetch to Firecrawl & scoring edge functions
(global as any).fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ id: '123' }) }),
);

describe('Paste URL flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits URL and navigates to product page', async () => {
    const { getByPlaceholderText, getByText } = render(<PasteScreen />);

    fireEvent.changeText(
      getByPlaceholderText('https://example.com/product'),
      'https://example.com/product',
    );
    fireEvent.press(getByText(/submit/i));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/product/123'));
  });
});
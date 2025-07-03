import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PasteScreen from '../app/paste';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

jest.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

describe('PasteScreen', () => {
  it('should call the correct functions and navigate on success', async () => {
    const mockUrl = 'https://example.com/product';
    const mockMarkdown = '## Product Title';
    const mockProductId = '123';

    (supabase.functions.invoke as jest.Mock)
      .mockResolvedValueOnce({ data: { markdown: mockMarkdown }, error: null })
      .mockResolvedValueOnce({ data: { id: mockProductId }, error: null });

    const { getByText, getByPlaceholderText } = render(<PasteScreen />);

    const input = getByPlaceholderText('https://example.com/product');
    fireEvent.changeText(input, mockUrl);

    const submitButton = getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('firecrawl-extract', {
        body: { url: mockUrl },
      });
    });

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('score-supplement', {
        body: { markdown: mockMarkdown },
      });
    });

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(`/product/${mockProductId}`);
    });
  });
});
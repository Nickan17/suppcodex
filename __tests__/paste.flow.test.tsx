import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PasteScreen from '../app/paste';
import { chainExtractToScore } from '../utils/api';
import { router } from 'expo-router';

// Mock the chainExtractToScore function
jest.mock('../utils/api', () => ({
  chainExtractToScore: jest.fn(),
}));

// Mock fetch
(global as any).fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ id: '123' }) }),
);

describe('Paste URL flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits URL and navigates to product page on success', async () => {
    (chainExtractToScore as jest.Mock).mockResolvedValueOnce({ 
      ok: true, 
      data: { id: '123', score: { final_score: 85, highlights: ['Good quality', 'Well tested'] } } 
    });

    const { getByPlaceholderText, getByText } = render(<PasteScreen />);

    fireEvent.changeText(
      getByPlaceholderText('https://example.com/product'),
      'https://example.com/product',
    );
    fireEvent.press(getByText(/submit/i));

    await waitFor(() => expect(chainExtractToScore).toHaveBeenCalledWith('https://example.com/product'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/product/123?score=' + encodeURIComponent(JSON.stringify({ final_score: 85, highlights: ['Good quality', 'Well tested'] }))));
  });

  it('shows error toast when processing fails', async () => {
    (chainExtractToScore as jest.Mock).mockResolvedValueOnce({ 
      ok: false, 
      status: 400, 
      message: 'Processing failed' 
    });

    const { getByPlaceholderText, getByText } = render(<PasteScreen />);

    fireEvent.changeText(
      getByPlaceholderText('https://example.com/product'),
      'https://example.com/product',
    );
    fireEvent.press(getByText(/submit/i));

    await waitFor(() => expect(chainExtractToScore).toHaveBeenCalledWith('https://example.com/product'));
  });
});
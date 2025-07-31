import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PasteScreen from '../app/paste';
import { chainExtractToScore } from '../utils/api';
import { router } from 'expo-router';

(global as any).fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
);

jest.mock('../utils/api', () => ({
  chainExtractToScore: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

describe('PasteScreen', () => {
  beforeEach(() => {
    (chainExtractToScore as jest.Mock).mockClear();
    (router.push as jest.Mock).mockClear();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should call the correct functions and navigate on success', async () => {
    const mockUrl = 'https://example.com/product';
    const mockProductId = '123';

    (chainExtractToScore as jest.Mock).mockResolvedValueOnce({ 
      ok: true, 
      data: { id: mockProductId, score: { final_score: 85, highlights: ['Good quality', 'Well tested'] } } 
    });

    const { getByText, getByPlaceholderText } = render(<PasteScreen />);

    const input = getByPlaceholderText('https://example.com/product');
    fireEvent.changeText(input, mockUrl);
    expect(input.props.value).toBe(mockUrl);

    const submitButton = getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(chainExtractToScore).toHaveBeenCalledWith(mockUrl);
    });

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(`/product/${mockProductId}?score=${encodeURIComponent(JSON.stringify({ final_score: 85, highlights: ['Good quality', 'Well tested'] }))}`);
    });
  });

  it('should show error toast when edge function fails', async () => {
    const mockUrl = 'https://example.com/product';
    const errorMessage = 'Processing failed';

    (chainExtractToScore as jest.Mock).mockResolvedValueOnce({ 
      ok: false, 
      status: 400, 
      message: errorMessage 
    });

    const { getByText, getByPlaceholderText } = render(<PasteScreen />);

    const input = getByPlaceholderText('https://example.com/product');
    fireEvent.changeText(input, mockUrl);

    const submitButton = getByText('Submit');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(chainExtractToScore).toHaveBeenCalledWith(mockUrl);
    });
  });
});
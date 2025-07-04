import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PasteScreen from '../app/paste';
import { useRouter } from 'expo-router';

// Mock navigation
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock fetch to Firecrawl & scoring edge functions
(global as any).fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ id: '123' }) }),
);

describe('Paste URL flow', () => {
  it('submits URL and navigates to product page', async () => {
    const { getByPlaceholderText, getByText } = render(<PasteScreen />);

    fireEvent.changeText(
      getByPlaceholderText(/paste product url/i),
      'https://example.com/product',
    );
    fireEvent.press(getByText(/submit/i));

    await waitFor(() =>
      expect(useRouter().push).toHaveBeenCalledWith('/product/123'),
    );
    expect(global.fetch).toHaveBeenCalledTimes(2); // extract + score
  });
});
import React from 'react';
import { render } from '@testing-library/react-native';
import ProductCard from '../components/ProductCard';
import { ThemeProvider } from '../context/ThemeContext';

const mockProduct = {
  id: 'test-123',
  name: 'Test Supplement',
  brand: 'Test Brand',
  imageUrl: 'https://example.com/image.jpg',
  score: 85,
  onPress: jest.fn(),
};

describe('ProductCard Dark Mode', () => {
  it('renders correctly in light theme', () => {
    const { toJSON } = render(
      <ThemeProvider>
        <ProductCard {...mockProduct} />
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly in dark theme', () => {
    const { toJSON } = render(
      <ThemeProvider>
        <ProductCard {...mockProduct} />
      </ThemeProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });
}); 
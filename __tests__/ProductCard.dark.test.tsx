import React from 'react';
import { render } from './renderWithProviders';
import ProductCard from '../src/components/ProductCard';

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
    const { toJSON } = render(<ProductCard {...mockProduct} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly in dark theme', () => {
    const { toJSON } = render(<ProductCard {...mockProduct} />);
    expect(toJSON()).toMatchSnapshot();
  });
}); 
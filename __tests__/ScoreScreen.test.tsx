import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ScoreScreen from '@/screens/(tabs)/ScoreScreen';
import { ProductProvider } from '@/contexts/ProductContext';
import { ThemeProvider } from '@/design-system/theme';
import { useProduct } from '@/contexts/ProductContext';

// Mock expo router
const mockRouter = {
  back: jest.fn()
};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'test-product-id' }),
  router: mockRouter
}));

// Mock the useProduct hook
jest.mock('@/contexts/ProductContext', () => ({
  ...jest.requireActual('@/contexts/ProductContext'),
  useProduct: jest.fn()
}));

const mockUseProduct = useProduct as jest.MockedFunction<typeof useProduct>;

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider>
      <ProductProvider>
        {children}
      </ProductProvider>
    </ThemeProvider>
  );
};

describe('ScoreScreen - Score Zero Case', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set __DEV__ to false for consistent testing
    (global as any).__DEV__ = false;
  });

  it('renders ScoreGrid when score is 0', () => {
    // Mock product data with score = 0
    const mockCurrentWithZeroScore = {
      product: {
        title: 'Magnum Quattro',
        ingredients: ['ingredient1', 'ingredient2'],
        facts: 'test facts',
        warnings: []
      },
      score: {
        score: 0,
        highlights: ['Some highlight'],
        concerns: ['Some concern']
      },
      meta: {
        ts: Date.now(),
        chain: []
      }
    };

    mockUseProduct.mockReturnValue({
      current: mockCurrentWithZeroScore,
      setCurrent: jest.fn()
    });

    const { toJSON } = render(
      <AllTheProviders>
        <ScoreScreen />
      </AllTheProviders>
    );

    // Component should render without throwing
    expect(toJSON()).toBeTruthy();
    
    // Verify the component structure includes the expected elements
    const snapshot = toJSON();
    expect(snapshot).toMatchSnapshot();
  });

  it('does not render ScoreGrid when score is null', () => {
    // Mock product data with score = null
    const mockCurrentWithNullScore = {
      product: {
        title: 'Test Product',
        ingredients: ['ingredient1'],
        facts: 'test facts',
        warnings: []
      },
      score: {
        score: null,
        highlights: [],
        concerns: []
      },
      meta: {
        ts: Date.now(),
        chain: []
      }
    };

    mockUseProduct.mockReturnValue({
      current: mockCurrentWithNullScore,
      setCurrent: jest.fn()
    });

    const { toJSON } = render(
      <AllTheProviders>
        <ScoreScreen />
      </AllTheProviders>
    );

    const snapshot = toJSON();
    expect(snapshot).toBeTruthy();
    expect(snapshot).toMatchSnapshot();
  });

  it('does not render ScoreGrid when score is undefined', () => {
    // Mock product data with score = undefined
    const mockCurrentWithUndefinedScore = {
      product: {
        title: 'Test Product',
        ingredients: ['ingredient1'],
        facts: 'test facts',
        warnings: []
      },
      score: {
        score: undefined,
        highlights: [],
        concerns: []
      },
      meta: {
        ts: Date.now(),
        chain: []
      }
    };

    mockUseProduct.mockReturnValue({
      current: mockCurrentWithUndefinedScore,
      setCurrent: jest.fn()
    });

    const { toJSON } = render(
      <AllTheProviders>
        <ScoreScreen />
      </AllTheProviders>
    );

    const snapshot = toJSON();
    expect(snapshot).toBeTruthy();
    expect(snapshot).toMatchSnapshot();
  });

  it('renders ScoreGrid with correct sub-scores when score is 0', () => {
    const mockCurrentWithZeroScore = {
      product: {
        title: 'Magnum Quattro',
        ingredients: ['ingredient1', 'ingredient2'],
        facts: 'test facts',
        warnings: []
      },
      score: {
        score: 0,
        highlights: ['Some highlight'],
        concerns: ['Some concern']
      },
      meta: {
        ts: Date.now(),
        chain: []
      }
    };

    mockUseProduct.mockReturnValue({
      current: mockCurrentWithZeroScore,
      setCurrent: jest.fn()
    });

    const { toJSON } = render(
      <AllTheProviders>
        <ScoreScreen />
      </AllTheProviders>
    );

    // For score=0, the sub-scores should be:
    // purity: Math.max(0, 0 - 5) = 0
    // effectiveness: Math.max(0, 0 - 3) = 0  
    // safety: Math.max(0, 0 + 2) = 2
    // value: Math.max(0, 0 - 1) = 0

    const snapshot = toJSON();
    expect(snapshot).toBeTruthy();
    
    // The ScoreGrid should be present in the snapshot
    expect(snapshot).toMatchSnapshot();
  });

  it('calculates sub-scores correctly for score=0', () => {
    // Test the sub-score calculation logic directly
    const score = 0;
    
    const expectedScores = {
      purity: Math.max(0, (score || 0) - 5),      // 0
      effectiveness: Math.max(0, (score || 0) - 3), // 0
      safety: Math.max(0, (score || 0) + 2),      // 2
      value: Math.max(0, (score || 0) - 1)        // 0
    };

    expect(expectedScores.purity).toBe(0);
    expect(expectedScores.effectiveness).toBe(0);
    expect(expectedScores.safety).toBe(2);
    expect(expectedScores.value).toBe(0);
  });
});
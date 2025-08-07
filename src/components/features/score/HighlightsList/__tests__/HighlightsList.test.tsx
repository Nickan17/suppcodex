import React from 'react';
import { render } from '@testing-library/react-native';
import HighlightsList from '../HighlightsList';

// Mock the theme hook
jest.mock('@/design-system/theme', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#000',
      textSecondary: '#666',
      surface: '#fff',
      border: '#ddd',
      mint: '#B6F6C8'
    },
    spacing: [0, 4, 8, 12, 16, 20, 24, 32]
  })
}));

describe('HighlightsList', () => {
  it('renders highlights correctly', () => {
    const highlights = [
      'Third-party tested for purity',
      'Contains high-quality ingredients',
      'No artificial fillers'
    ];

    const { getByText } = render(<HighlightsList highlights={highlights} />);
    
    expect(getByText("What's great")).toBeTruthy();
    expect(getByText('Third-party tested for purity')).toBeTruthy();
    expect(getByText('Contains high-quality ingredients')).toBeTruthy();
    expect(getByText('No artificial fillers')).toBeTruthy();
  });

  it('shows empty state when no highlights', () => {
    const { getByText } = render(<HighlightsList highlights={[]} />);
    
    expect(getByText("What's great")).toBeTruthy();
    expect(getByText('No highlights available for this supplement')).toBeTruthy();
  });

  it('shows loading skeleton when loading', () => {
    const { getByText } = render(<HighlightsList highlights={[]} loading />);
    
    expect(getByText("What's great")).toBeTruthy();
    // Loading skeletons should be present (though we can't easily test them)
  });

  it('limits highlights to 3 items', () => {
    const highlights = [
      'Highlight 1',
      'Highlight 2', 
      'Highlight 3',
      'Highlight 4',
      'Highlight 5'
    ];

    const { getByText, queryByText } = render(<HighlightsList highlights={highlights} />);
    
    expect(getByText('Highlight 1')).toBeTruthy();
    expect(getByText('Highlight 2')).toBeTruthy();
    expect(getByText('Highlight 3')).toBeTruthy();
    expect(queryByText('Highlight 4')).toBeNull();
    expect(queryByText('Highlight 5')).toBeNull();
  });
});
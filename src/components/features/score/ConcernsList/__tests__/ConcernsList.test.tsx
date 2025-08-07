import React from 'react';
import { render } from '@testing-library/react-native';
import ConcernsList from '../ConcernsList';

// Mock the theme hook
jest.mock('@/design-system/theme', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#000',
      textSecondary: '#666',
      surface: '#fff',
      border: '#ddd',
      peach: '#FFAB7A',
      semantic: { warning: '#EAB308' }
    },
    spacing: [0, 4, 8, 12, 16, 20, 24, 32]
  })
}));

describe('ConcernsList', () => {
  it('renders concerns correctly', () => {
    const concerns = [
      'Contains artificial flavoring',
      'Higher price point',
      'May cause digestive issues'
    ];

    const { getByText } = render(<ConcernsList concerns={concerns} />);
    
    expect(getByText('Worth a look')).toBeTruthy();
    expect(getByText('Contains artificial flavoring')).toBeTruthy();
    expect(getByText('Higher price point')).toBeTruthy();
    expect(getByText('May cause digestive issues')).toBeTruthy();
  });

  it('shows empty state when no concerns', () => {
    const { getByText } = render(<ConcernsList concerns={[]} />);
    
    expect(getByText('Worth a look')).toBeTruthy();
    expect(getByText('No concerns identified for this supplement')).toBeTruthy();
  });

  it('shows loading skeleton when loading', () => {
    const { getByText } = render(<ConcernsList concerns={[]} loading />);
    
    expect(getByText('Worth a look')).toBeTruthy();
    // Loading skeletons should be present (though we can't easily test them)
  });

  it('limits concerns to 3 items', () => {
    const concerns = [
      'Concern 1',
      'Concern 2', 
      'Concern 3',
      'Concern 4',
      'Concern 5'
    ];

    const { getByText, queryByText } = render(<ConcernsList concerns={concerns} />);
    
    expect(getByText('Concern 1')).toBeTruthy();
    expect(getByText('Concern 2')).toBeTruthy();
    expect(getByText('Concern 3')).toBeTruthy();
    expect(queryByText('Concern 4')).toBeNull();
    expect(queryByText('Concern 5')).toBeNull();
  });
});
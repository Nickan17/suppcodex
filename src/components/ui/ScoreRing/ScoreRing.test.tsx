import React from 'react';
import { render } from '@testing-library/react-native';
import { ScoreRing } from './ScoreRing';
import { ThemeProvider } from '@/design-system/theme';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('ScoreRing', () => {
  it('renders correctly with basic props', () => {
    const { toJSON } = renderWithTheme(
      <ScoreRing size={200} value={95} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly with label', () => {
    const { toJSON } = renderWithTheme(
      <ScoreRing size={200} value={88} label="Overall Score" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('displays correct grade for high score', () => {
    const { getByText } = renderWithTheme(
      <ScoreRing size={200} value={95} />
    );
    expect(getByText('A+')).toBeTruthy();
    expect(getByText('95 / 100')).toBeTruthy();
  });

  it('displays correct grade for medium score', () => {
    const { getByText } = renderWithTheme(
      <ScoreRing size={200} value={75} />
    );
    expect(getByText('B')).toBeTruthy();
    expect(getByText('75 / 100')).toBeTruthy();
  });

  it('displays label when provided', () => {
    const { getByText } = renderWithTheme(
      <ScoreRing size={200} value={88} label="Test Label" />
    );
    expect(getByText('Test Label')).toBeTruthy();
  });
});
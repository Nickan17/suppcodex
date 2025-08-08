import React from 'react';
import { render } from '@testing-library/react-native';
import ScoreRing from './ScoreRing';
import { ThemeProvider } from '../../../design-system/theme';

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
      <ScoreRing size={200} score={95} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders correctly with label', () => {
    const { toJSON } = renderWithTheme(
      <ScoreRing size={200} score={88} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('displays correct grade for high score', () => {
    const { getByText } = renderWithTheme(
      <ScoreRing size={200} score={95} grade="A+" />
    );
    expect(getByText('A+')).toBeTruthy();
    expect(getByText('95 / 100')).toBeTruthy();
  });

  it('displays correct grade for medium score', () => {
    const { getByText } = renderWithTheme(
      <ScoreRing size={200} score={75} grade="B" />
    );
    expect(getByText('B')).toBeTruthy();
    expect(getByText('75 / 100')).toBeTruthy();
  });

  it('displays score text', () => {
    const { getByText } = renderWithTheme(
      <ScoreRing size={200} score={88} />
    );
    expect(getByText('88 / 100')).toBeTruthy();
  });
});
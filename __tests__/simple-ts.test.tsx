import React from 'react';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';

describe('Simple TypeScript Test', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <View>
        <Text>Hello World</Text>
      </View>
    );
    expect(getByText('Hello World')).toBeTruthy();
  });
});

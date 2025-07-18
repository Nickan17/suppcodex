import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';

test('renders correctly', () => {
  const { getByText } = render(
    <View>
      <Text>Test Text</Text>
    </View>
  );
  expect(getByText('Test Text')).toBeTruthy();
});

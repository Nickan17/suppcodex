import React from 'react';
import { render } from '@testing-library/react-native';
import SupplementFactsTable from '@/components/SupplementFactsTable';

describe('SupplementFactsTable', () => {
  it('renders correctly at <320px width', () => {
    const tree = render(
      <SupplementFactsTable facts="Serving Size: 1 Softgel\nAmount Per Serving: Calories 10\nTotal Fat 1g\nVitamin D 25mcg" />
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });
}); 
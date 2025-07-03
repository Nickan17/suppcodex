// Better assertions for React Native
import '@testing-library/jest-native/extend-expect';

// Polyfill fetch / Headers / Request / Response
import 'whatwg-fetch';

// Random values polyfill used by expo-crypto etc.
import 'react-native-get-random-values';

// Mock expo-router navigation so tests don’t crash
jest.mock('expo-router', () => {
  const originalModule = jest.requireActual('expo-router');
  return {
    ...originalModule,
    useRouter: () => ({
      push: jest.fn(),
      back: jest.fn(),
      replace: jest.fn(),
    }),
    useLocalSearchParams: () => ({}),
    router: {
      push: jest.fn(),
      back: jest.fn(),
      replace: jest.fn(),
    },
  };
});

// Silence & speed up react-native-reanimated
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

// Default no-op fetch so tests don’t hit the network; individual tests can override
if (!global.fetch) {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  );
}
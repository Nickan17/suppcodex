process.env.SUPABASE_JWT_SECRET ??= "test-secret";
// Better assertions for React Native
import '@testing-library/jest-native/extend-expect';

// Polyfill setImmediate/clearImmediate for React Native's use of timers
global.setImmediate = global.setImmediate || ((fn, ...args) => setTimeout(fn, 0, ...args));
global.clearImmediate = global.clearImmediate || clearTimeout;

// Polyfill fetch / Headers / Request / Response
import 'whatwg-fetch';

// Random values polyfill used by expo-crypto etc.
import 'react-native-get-random-values';

// Silence & speed up react-native-reanimated
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

// Mock AsyncStorage for React Native
import mockAsyncStorage from "./__mocks__/asyncStorageMock.js";
jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

// Mock Expo Constants
jest.mock('expo-constants', () => ({
  manifest: {},
  expoConfig: {},
  appOwnership: 'expo',
  platform: { ios: {}, android: {}, web: {} },
  deviceName: 'jest-device',
  deviceYearClass: 2023,
  executionEnvironment: 'standalone',
  isDevice: false,
  sessionId: 'test-session',
  systemFonts: [],
  systemVersion: '1.0.0',
}));

// Mock Supabase
jest.mock("@/services/supabase", () => require("./__mocks__/lib/supabase.js"));

// Default no-op fetch so tests don’t hit the network; individual tests can override
if (!global.fetch) {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  );
}
/* eslint-env node */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./jest.setup.js'],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-runner|@react-native|react-native|react-clone-referenced-element|@react-native-community|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|@sentry/.*))"
  ],
  testPathIgnorePatterns: ['/supabase/'],
  moduleNameMapper: {
    "^expo/src/winter/.*$": "<rootDir>/__mocks__/expo-winter-runtime.js",
    '^~/(.*)$': '<rootDir>/$1',
    '^@/(.*)$': '<rootDir>/$1',
    '^@/lib/supabase$': '<rootDir>/__mocks__/lib/supabase.js',
    '^../lib/supabase$': '<rootDir>/__mocks__/lib/supabase.js',
    '^../lib/supabase.ts$': '<rootDir>/__mocks__/lib/supabase.js',
    '^lib/supabase$': '<rootDir>/__mocks__/lib/supabase.js',
    '^lib/supabase.ts$': '<rootDir>/__mocks__/lib/supabase.js',
    '\\.(png|jpe?g|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '^expo/src/.*$': '<rootDir>/__mocks__/expoWinterStub.js',
    '^expo-haptics$': '<rootDir>/__mocks__/expo-haptics.js',
    '^react-native-toast-message$': '<rootDir>/__mocks__/react-native-toast-message.js',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  globals: {
    __DEV__: true,
  },
  testMatch: ['**/__tests__/**/*.test.(js|jsx|ts|tsx)'],
};

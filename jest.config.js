/* eslint-env node */
module.exports = {
  preset: 'jest-expo',                  // ← published preset for Expo 53
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-runner|@react-native|react-native'
    + '|@react-native/community|expo(nent)?|@expo(nent)?|expo-modules-core|expo-status-bar|expo-constants'
    + '|react-navigation|@react-navigation'
    + '|@unimodules|unimodules|sentry-expo|native-base|@sentry)/)',
  ],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/$1',
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(png|jpe?g|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
};

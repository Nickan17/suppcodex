/* eslint-env node */
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./jest.setup.js'],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-runner|@react-native|react-native|react-clone-referenced-element|@react-native-community|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|@sentry/.*))"
  ],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/$1',
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(png|jpe?g|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    '^expo/src/.*$': '<rootDir>/__mocks__/expoWinterStub.js',
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

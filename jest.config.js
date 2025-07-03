module.exports = {
  preset: 'jest-expo',

  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],

  // 👇  Make *all* Expo modules (including expo-modules-core) go through Babel
  transformIgnorePatterns: [
    'node_modules/(?!(expo(nent)?' +            // expo, exponent
      '|@expo' +                               // any @expo/*
      '|expo-modules-core' +                   // the one blowing up
      '|expo-.*' +                             // any other expo-* pkgs
      '|react-native' +                        // react-native + forks
      '|@react-native' +                       // scoped RN libs
      '|@react-navigation' +                   // navigation libs
    ')/)',
  ],

  moduleNameMapper: {
    '\\.svg$': '<rootDir>/__mocks__/svgMock.js',
  },
};

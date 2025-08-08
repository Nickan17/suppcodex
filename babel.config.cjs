module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': './src',
            '@/design-system': './src/design-system',
            '@/components': './components',
            '@/src': './src',
          },
        },
      ],
    ],
  };
};
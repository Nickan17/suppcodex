// @ts-check
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add alias resolver
config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

module.exports = config;
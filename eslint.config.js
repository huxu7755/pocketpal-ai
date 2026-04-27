const reactNative = require('@react-native/eslint-config');
const prettier = require('eslint-config-prettier');

module.exports = [
  ...reactNative,
  prettier,
  {
    ignores: [
      'coverage/',
      'node_modules/',
      'android/',
      'ios/',
      'build/',
      'dist/',
      'e2e/',
    ],
    rules: {
      'prettier/prettier': 'error',
      'no-console': 'error',
    },
  },
];
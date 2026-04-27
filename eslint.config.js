import { defineConfig } from 'eslint';
import reactNative from '@react-native/eslint-config';
import prettier from 'eslint-config-prettier';

export default defineConfig({
  root: true,
  extends: [
    ...reactNative,
    prettier,
  ],
  ignorePatterns: [
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
});
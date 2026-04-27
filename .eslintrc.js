module.exports = {
  extends: ['@react-native', 'plugin:prettier/recommended'],
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
    'no-console': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'handle-callback-err': 'off',
  },
};

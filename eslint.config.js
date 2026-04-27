import reactNative from '@react-native/eslint-config';
import prettier from 'eslint-config-prettier';

export default [
  ...reactNative,
  prettier,
  {
    rules: {
      'prettier/prettier': 'error',
      'no-console': 'error',
    },
  },
];
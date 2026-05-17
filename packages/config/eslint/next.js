const react = require('./react');

module.exports = {
  ...react,
  extends: [
    ...react.extends,
    'next/core-web-vitals',
    'plugin:@next/next/recommended',
  ],
  rules: {
    ...react.rules,
    '@next/next/no-html-link-for-pages': 'off',
  },
};